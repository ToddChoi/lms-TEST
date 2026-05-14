/**
 * 오프라인 회차의 출석률 계산.
 *
 * 정책: 단순 비율 — present / total_days × 100.
 * 향후 시간 가중 평균 (Q5 결정 — 명세에 적혀있지만 schema 변경 필요해 다음 라운드).
 *
 * present + late 둘 다 출석으로 카운트. absent / 미체크는 결석.
 */

export interface AttendanceCount {
  present: number  // present + late
  total: number    // session_days 총 수
  rate: number     // 0-100 (반올림)
}

export function calculateAttendanceRate(
  presentCount: number,
  totalDays: number
): number {
  if (totalDays <= 0) return 0
  return Math.round((presentCount / totalDays) * 100)
}

/**
 * 한 enrollment 의 출석률 계산.
 * 인자:
 *   attendanceRows: offline_attendance 의 status 배열 (present/absent/late)
 *   totalDays: offline_session_days 총 수
 */
export function attendanceRateFromRows(
  rows: Array<{ status: 'present' | 'absent' | 'late' }>,
  totalDays: number
): AttendanceCount {
  const present = rows.filter((r) => r.status === 'present' || r.status === 'late').length
  return {
    present,
    total: totalDays,
    rate: calculateAttendanceRate(present, totalDays),
  }
}
