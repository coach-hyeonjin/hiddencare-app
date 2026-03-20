import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const TABS = ['내정보', '운동기록', '개인운동입력', '식단', '루틴', '사용방법']

const emptyPersonalForm = {
  id: null,
  workout_date: new Date().toISOString().slice(0, 10),
  good: '',
  improve: '',
  items: [
    {
      exercise_id: '',
      exercise_name_snapshot: '',
      sets: [{ kg: '', reps: '' }],
    },
  ],
}

const emptyDietForm = {
  id: null,
  log_date: new Date().toISOString().slice(0, 10),
  meal_type: '식단',
  content: '',
}

function totalSetCount(items = []) {
  return items.reduce((sum, item) => sum + (item.sets?.length || 0), 0)
}

export default function MemberDashboard({ member, accessCode, onLogout }) {
  const [activeTab, setActiveTab] = useState('내정보')
  const [memberInfo, setMemberInfo] = useState(member)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [workouts, setWorkouts] = useState([])
  const [workoutItemsMap, setWorkoutItemsMap] = useState({})
  const [collapsedWorkouts, setCollapsedWorkouts] = useState({})

  const [exercises, setExercises] = useState([])
  const [personalForm, setPersonalForm] = useState(emptyPersonalForm)

  const [dietLogs, setDietLogs] = useState([])
  const [collapsedDiets, setCollapsedDiets] = useState({})
  const [dietForm, setDietForm] = useState(emptyDietForm)

  const [routine, setRoutine] = useState(null)
  const [manual, setManual] = useState(null)

  const progressPercent = useMemo(() => {
    const total = Number(memberInfo?.total_sessions || 0)
    const used = Number(memberInfo?.used_sessions || 0)
    if (!total) return 0
    return Math.min(Math.round((used / total) * 100), 100)
  }, [memberInfo])

  useEffect(() => {
    loadAll()
  }, [memberInfo?.id])

  const loadAll = async () => {
    setLoading(true)
    setMessage('')

    await Promise.all([
      loadMemberInfo(),
      loadExercises(),
      loadWorkouts(),
      loadDietLogs(),
      loadRoutine(),
      loadManual(),
    ])

    setLoading(false)
  }

  const loadMemberInfo = async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('id', member.id)
      .maybeSingle()

    if (data) {
      setMemberInfo(data)
      localStorage.setItem(
        'hiddencare_member_session_v1',
        JSON.stringify({
          member: data,
          accessCode,
        }),
      )
    }
  }

  const loadExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*, brands(id, name)')
      .order('created_at', { ascending: false })

    if (data) setExercises(data)
  }

  const loadWorkouts = async () => {
    const { data: workoutData } = await supabase
      .from('workouts')
      .select('*')
      .eq('member_id', member.id)
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!workoutData) return

    const workoutIds = workoutData.map((w) => w.id)
    let itemMap = {}

    if (workoutIds.length > 0) {
      const { data: itemData } = await supabase
        .from('workout_items')
        .select('*')
        .in('workout_id', workoutIds)
        .order('sort_order', { ascending: true })

      itemMap = (itemData || []).reduce((acc, item) => {
        if (!acc[item.workout_id]) acc[item.workout_id] = []
        acc[item.workout_id].push(item)
        return acc
      }, {})
    }

    setWorkouts(workoutData)
    setWorkoutItemsMap(itemMap)
    const defaultCollapse = {}
    workoutData.forEach((w) => {
      defaultCollapse[w.id] = true
    })
    setCollapsedWorkouts(defaultCollapse)
  }

  const loadDietLogs = async () => {
    const { data } = await supabase
      .from('diet_logs')
      .select('*')
      .eq('member_id', member.id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) {
      setDietLogs(data)
      const defaultCollapse = {}
      data.forEach((d) => {
        defaultCollapse[d.id] = true
      })
      setCollapsedDiets(defaultCollapse)
    }
  }

  const loadRoutine = async () => {
    const { data } = await supabase
      .from('member_routines')
      .select('*')
      .eq('member_id', member.id)
      .maybeSingle()

    setRoutine(data || null)
  }

  const loadManual = async () => {
    const { data } = await supabase
      .from('app_manuals')
      .select('*')
      .eq('target_role', 'member')
      .maybeSingle()

    setManual(data || null)
  }

  const updatePersonalExercise = (index, exerciseId) => {
    const found = exercises.find((ex) => String(ex.id) === String(exerciseId))
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[index] = {
        ...nextItems[index],
        exercise_id: found?.id || '',
        exercise_name_snapshot: found?.name || '',
      }
      return { ...prev, items: nextItems }
    })
  }

  const addPersonalItem = () => {
    setPersonalForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          exercise_id: '',
          exercise_name_snapshot: '',
          sets: [{ kg: '', reps: '' }],
        },
      ],
    }))
  }

  const removePersonalItem = (index) => {
    setPersonalForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const addPersonalSet = (itemIndex) => {
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        sets: [...nextItems[itemIndex].sets, { kg: '', reps: '' }],
      }
      return { ...prev, items: nextItems }
    })
  }

  const removePersonalSet = (itemIndex, setIndex) => {
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        sets: nextItems[itemIndex].sets.filter((_, i) => i !== setIndex),
      }
      return { ...prev, items: nextItems }
    })
  }

  const updatePersonalSetValue = (itemIndex, setIndex, field, value) => {
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      const nextSets = [...nextItems[itemIndex].sets]
      nextSets[setIndex] = { ...nextSets[setIndex], [field]: value }
      nextItems[itemIndex] = { ...nextItems[itemIndex], sets: nextSets }
      return { ...prev, items: nextItems }
    })
  }

  const resetPersonalForm = () => {
    setPersonalForm(emptyPersonalForm)
  }

  const handlePersonalWorkoutSubmit = async (e) => {
    e.preventDefault()

    const cleanedItems = personalForm.items
      .filter((item) => item.exercise_name_snapshot)
      .map((item, index) => ({
        exercise_id: item.exercise_id || null,
        exercise_name_snapshot: item.exercise_name_snapshot,
        sort_order: index,
        sets: item.sets.filter((set) => set.kg !== '' || set.reps !== ''),
      }))

    if (cleanedItems.length === 0) {
      setMessage('최소 1개의 운동을 입력해주세요.')
      return
    }

    const payload = {
      member_id: member.id,
      workout_date: personalForm.workout_date,
      workout_type: 'personal',
      good: personalForm.good,
      improve: personalForm.improve,
      created_by: null,
    }

    let workoutId = personalForm.id

    if (personalForm.id) {
      await supabase.from('workouts').update(payload).eq('id', personalForm.id)
      await supabase.from('workout_items').delete().eq('workout_id', personalForm.id)
    } else {
      const { data } = await supabase.from('workouts').insert(payload).select().single()
      workoutId = data.id
    }

    await supabase.from('workout_items').insert(
      cleanedItems.map((item) => ({
        ...item,
        workout_id: workoutId,
      })),
    )

    setMessage(personalForm.id ? '개인운동이 수정되었습니다.' : '개인운동이 저장되었습니다.')
    resetPersonalForm()
    await loadWorkouts()
    setActiveTab('운동기록')
  }

  const handlePersonalWorkoutEdit = (workout) => {
    const items = workoutItemsMap[workout.id] || []
    setPersonalForm({
      id: workout.id,
      workout_date: workout.workout_date,
      good: workout.good || '',
      improve: workout.improve || '',
      items: items.length
        ? items.map((item) => ({
            exercise_id: item.exercise_id || '',
            exercise_name_snapshot: item.exercise_name_snapshot || '',
            sets: Array.isArray(item.sets) && item.sets.length ? item.sets : [{ kg: '', reps: '' }],
          }))
        : [
            {
              exercise_id: '',
              exercise_name_snapshot: '',
              sets: [{ kg: '', reps: '' }],
            },
          ],
    })
    setActiveTab('개인운동입력')
  }

  const handlePersonalWorkoutDelete = async (workoutId) => {
    if (!window.confirm('개인운동 기록을 삭제할까요?')) return
    await supabase.from('workouts').delete().eq('id', workoutId)
    await loadWorkouts()
    setMessage('개인운동 기록이 삭제되었습니다.')
  }

  const handleDietSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      member_id: member.id,
      log_date: dietForm.log_date,
      meal_type: dietForm.meal_type,
      content: dietForm.content,
    }

    if (dietForm.id) {
      await supabase.from('diet_logs').update(payload).eq('id', dietForm.id)
      setMessage('식단이 수정되었습니다.')
    } else {
      await supabase.from('diet_logs').insert(payload)
      setMessage('식단이 저장되었습니다.')
    }

    setDietForm(emptyDietForm)
    await loadDietLogs()
  }

  const handleDietEdit = (diet) => {
    setDietForm({
      id: diet.id,
      log_date: diet.log_date,
      meal_type: diet.meal_type || '식단',
      content: diet.content || '',
    })
    setActiveTab('식단')
  }

  const handleDietDelete = async (dietId) => {
    if (!window.confirm('식단을 삭제할까요?')) return
    await supabase.from('diet_logs').delete().eq('id', dietId)
    await loadDietLogs()
    setMessage('식단이 삭제되었습니다.')
  }

  if (loading) {
    return <div className="loading-card">데이터 불러오는 중...</div>
  }

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">숨바꼭질케어</div>
          <h1 className="page-title">{memberInfo.name} 회원 화면</h1>
          <p className="sub-text">access code 인증 완료</p>
        </div>
        <button className="secondary-btn" onClick={onLogout}>
          나가기
        </button>
      </header>

      <nav className="tab-row">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {message ? <div className="message success">{message}</div> : null}

      {activeTab === '내정보' && (
        <div className="two-col">
          <section className="card">
            <h2>내 정보</h2>
            <div className="detail-box">
              <p><strong>이름:</strong> {memberInfo.name}</p>
              <p><strong>목표:</strong> {memberInfo.goal || '-'}</p>
              <p><strong>시작일:</strong> {memberInfo.start_date || '-'}</p>
              <p><strong>종료일:</strong> {memberInfo.end_date || '-'}</p>
              <p><strong>메모:</strong> {memberInfo.memo || '-'}</p>
            </div>
          </section>

          <section className="card">
            <h2>세션 진행 현황</h2>
            <div className="detail-box">
              <p><strong>총 세션:</strong> {memberInfo.total_sessions || 0}회</p>
              <p><strong>사용 세션:</strong> {memberInfo.used_sessions || 0}회</p>
              <p><strong>남은 세션:</strong> {Math.max((memberInfo.total_sessions || 0) - (memberInfo.used_sessions || 0), 0)}회</p>
            </div>

            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <span>{progressPercent}% 진행</span>
            </div>
          </section>
        </div>
      )}

      {activeTab === '운동기록' && (
        <div className="card">
          <h2>운동기록</h2>
          <div className="list-stack">
            {workouts.map((workout) => {
              const items = workoutItemsMap[workout.id] || []
              const collapsed = collapsedWorkouts[workout.id] ?? true
              const isPersonal = workout.workout_type === 'personal'

              return (
                <div key={workout.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{isPersonal ? '개인운동' : 'PT 기록'}</strong>
                    <span className="pill">{workout.workout_date}</span>
                  </div>

                  <div className="compact-text">
                    간추려보기: 날짜 {workout.workout_date} / 운동 {items.length}개 / 총세트 {totalSetCount(items)}세트
                  </div>

                  <div className="inline-actions wrap">
                    <button
                      className="secondary-btn"
                      onClick={() =>
                        setCollapsedWorkouts((prev) => ({
                          ...prev,
                          [workout.id]: !collapsed,
                        }))
                      }
                    >
                      {collapsed ? '상세히보기' : '간추려보기'}
                    </button>

                    {isPersonal ? (
                      <>
                        <button className="secondary-btn" onClick={() => handlePersonalWorkoutEdit(workout)}>
                          수정
                        </button>
                        <button className="danger-btn" onClick={() => handlePersonalWorkoutDelete(workout.id)}>
                          삭제
                        </button>
                      </>
                    ) : null}
                  </div>

                  {!collapsed ? (
                    <div className="detail-box">
                      {items.map((item) => (
                        <div key={item.id} className="record-item-box">
                          <strong>{item.exercise_name_snapshot}</strong>
                          <ul className="set-list">
                            {(item.sets || []).map((setRow, index) => (
                              <li key={index}>
                                {index + 1}세트 - {setRow.kg || '-'}kg / {setRow.reps || '-'}회
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <p><strong>잘한점:</strong> {workout.good || '-'}</p>
                      <p><strong>보완점:</strong> {workout.improve || '-'}</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === '개인운동입력' && (
        <div className="card">
          <h2>개인운동 입력 / 수정</h2>
          <form className="stack-gap" onSubmit={handlePersonalWorkoutSubmit}>
            <label className="field">
              <span>날짜</span>
              <input
                type="date"
                value={personalForm.workout_date}
                onChange={(e) => setPersonalForm({ ...personalForm, workout_date: e.target.value })}
              />
            </label>

            {personalForm.items.map((item, itemIndex) => (
              <div key={itemIndex} className="sub-card">
                <div className="list-card-top">
                  <strong>운동 {itemIndex + 1}</strong>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => removePersonalItem(itemIndex)}
                    disabled={personalForm.items.length === 1}
                  >
                    운동 삭제
                  </button>
                </div>

                <label className="field">
                  <span>운동 선택</span>
                  <select
                    value={item.exercise_id}
                    onChange={(e) => updatePersonalExercise(itemIndex, e.target.value)}
                  >
                    <option value="">운동 선택</option>
                    {exercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        [{exercise.brands?.name || '브랜드없음'}] {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="stack-gap">
                  {item.sets.map((setRow, setIndex) => (
                    <div className="set-row" key={setIndex}>
                      <input
                        placeholder="kg"
                        value={setRow.kg}
                        onChange={(e) =>
                          updatePersonalSetValue(itemIndex, setIndex, 'kg', e.target.value)
                        }
                      />
                      <input
                        placeholder="reps"
                        value={setRow.reps}
                        onChange={(e) =>
                          updatePersonalSetValue(itemIndex, setIndex, 'reps', e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => removePersonalSet(itemIndex, setIndex)}
                        disabled={item.sets.length === 1}
                      >
                        세트 삭제
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => addPersonalSet(itemIndex)}
                >
                  세트 추가
                </button>
              </div>
            ))}

            <button type="button" className="secondary-btn" onClick={addPersonalItem}>
              운동 추가
            </button>

            <label className="field">
              <span>잘한점</span>
              <textarea
                rows="3"
                value={personalForm.good}
                onChange={(e) => setPersonalForm({ ...personalForm, good: e.target.value })}
              />
            </label>

            <label className="field">
              <span>보완점</span>
              <textarea
                rows="3"
                value={personalForm.improve}
                onChange={(e) => setPersonalForm({ ...personalForm, improve: e.target.value })}
              />
            </label>

            <div className="inline-actions">
              <button className="primary-btn" type="submit">
                {personalForm.id ? '개인운동 수정' : '개인운동 저장'}
              </button>
              <button type="button" className="secondary-btn" onClick={resetPersonalForm}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === '식단' && (
        <div className="two-col">
          <section className="card">
            <h2>식단 입력 / 수정</h2>
            <form className="stack-gap" onSubmit={handleDietSubmit}>
              <label className="field">
                <span>날짜</span>
                <input
                  type="date"
                  value={dietForm.log_date}
                  onChange={(e) => setDietForm({ ...dietForm, log_date: e.target.value })}
                />
              </label>

              <label className="field">
                <span>구분</span>
                <input
                  value={dietForm.meal_type}
                  onChange={(e) => setDietForm({ ...dietForm, meal_type: e.target.value })}
                  placeholder="아침 / 점심 / 저녁 / 간식"
                />
              </label>

              <label className="field">
                <span>내용</span>
                <textarea
                  rows="6"
                  value={dietForm.content}
                  onChange={(e) => setDietForm({ ...dietForm, content: e.target.value })}
                />
              </label>

              <div className="inline-actions">
                <button className="primary-btn" type="submit">
                  {dietForm.id ? '식단 수정' : '식단 저장'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setDietForm(emptyDietForm)}
                >
                  초기화
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>내 식단 기록</h2>
            <div className="list-stack">
              {dietLogs.map((diet) => {
                const collapsed = collapsedDiets[diet.id] ?? true

                return (
                  <div key={diet.id} className="list-card">
                    <div className="list-card-top">
                      <strong>{diet.meal_type}</strong>
                      <span className="pill">{diet.log_date}</span>
                    </div>

                    <div className="compact-text">
                      간추려보기: {diet.content.slice(0, 30)}{diet.content.length > 30 ? '...' : ''}
                    </div>

                    <div className="inline-actions wrap">
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          setCollapsedDiets((prev) => ({ ...prev, [diet.id]: !collapsed }))
                        }
                      >
                        {collapsed ? '상세히보기' : '간추려보기'}
                      </button>
                      <button className="secondary-btn" onClick={() => handleDietEdit(diet)}>
                        수정
                      </button>
                      <button className="danger-btn" onClick={() => handleDietDelete(diet.id)}>
                        삭제
                      </button>
                    </div>

                    {!collapsed ? (
                      <div className="detail-box">
                        <p><strong>내용:</strong> {diet.content}</p>
                        <p><strong>관리자 피드백:</strong> {diet.coach_feedback || '아직 피드백이 없습니다.'}</p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === '루틴' && (
        <div className="card">
          <h2>{routine?.title || '루틴'}</h2>
          <div className="detail-box">
            <pre className="pre-text">{routine?.content || '아직 등록된 루틴이 없습니다.'}</pre>
          </div>
        </div>
      )}

      {activeTab === '사용방법' && (
        <div className="card">
          <h2>{manual?.title || '사용방법'}</h2>
          <div className="detail-box">
            <pre className="pre-text">{manual?.content || '아직 등록된 사용방법이 없습니다.'}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
