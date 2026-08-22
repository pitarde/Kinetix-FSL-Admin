import { useEffect, useState } from 'react'
import { subscribeLearners } from '../firestore/learners'

/** Live list of every learner (progress/{uid}), with loading + error state. */
export function useLearners() {
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsub = subscribeLearners(
      (data) => { setLearners(data); setLoading(false); setError(null) },
      (err) => { setError(err); setLoading(false) },
    )
    return unsub
  }, [])

  return { learners, loading, error }
}
