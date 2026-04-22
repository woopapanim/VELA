# VELA 시뮬레이션 문제 해결 계획서

**작성일**: 2026-04-22
**기준 커밋**: `11cd07e`

---

## 1. 현재 상태 스냅샷

**측정값** (최근 시뮬 결과, 2nd entry/exit 추가 후):
- 완주율: 54% (↑ from 33%)
- 조기이탈 (1-2존): 47% (90명)
- 스킵률: 49% (231/244)
- 0개 존 이탈: 42% (여전히 발생 — 예상과 다름)
- 히어로 완주율: 4%
- Entry 비율: 64:36 (불균형)
- Exit 비율: 64:36 (불균형)

**Peak 흐름**:
- Corridor 217 → Ex 216 = 83%
- Lobby 209 → Ex 211 = 85%

---

## 2. 이슈 목록 (A–J)

| # | 문제 | 성격 | 우선순위 | 추정 원인 |
|---|------|------|--------|-----------|
| **A** | 42% 관람객이 "0개 존 방문" | 데이터/트래킹 | 🔴 critical | B의 부산물? |
| **B** | 디오라마 부근 MOVING 상태 멈춤 (CONGESTED 89명) | 물리/슬롯 | 🔴 critical | watchArea 도달 실패 |
| **H** | Transit 중 벽 통과 버그 (CLAUDE.md 명시) | 물리 | 🔴 critical | `stepCollision`이 transit 상태 무시 |
| **C** | 벽 끼임 → 에이전트 퇴장 못 함 | 충돌/탈출 | 🟡 high | B/H 해결 후 재측정 |
| **D** | 히어로 완주율 4% | 라우팅/피로도 | 🟡 high | 피로도 decay? mustVisit 튜닝? |
| **I** | Entry/Exit 64:36 불균형 | 스폰/선택 로직 | 🟡 high | spawn weight, 근접 exit 선택 |
| **J** | 쵸크포인트 85%/83% (Lobby→211, Corridor217→216) | 토폴로지/가중치 | 🟡 high | edge passWeight or hub 분기 |
| **E** | 완주율 기준 ≥3존 → ≥90% 관람 변경 | 정의 변경 | 🟢 medium | report 측 수정 |
| **F** | 인기 미디어 복제 인사이트에 미디어 이름 누락 | UX | 🟢 medium | report 측 수정 |
| **G** | 체류시간 분포 그래프 상단 잘림 | UX | 🟢 low | chart option |

---

## 3. 실행 순서 (phased)

### Phase 1 — 물리/데이터 근본 원인 (A, B, H 한 묶음)
**가설**: A/B/H는 한 원인의 다른 증상.
- MOVING → WATCHING 전이 실패로 watchArea 도달 못 함 (B)
- 미디어/존 credit 안 되고 바로 exit → 0존 (A)
- Transit 중 벽 통과로 엉뚱한 곳에 도달 (H)

**작업**:
1. B 진단: 디오라마 타겟 에이전트 89명 로그 — 어디서 멈추는지, 왜 WATCHING 못 가는지
2. H 수정: `stepCollision`에 transit 에이전트도 zone 벽 충돌 적용, gate만 통과 허용
3. A 재측정 — 대부분 해소 예상

**완료 조건**: 0존 < 5%, CONGESTED < 10명

---

### Phase 2 — 잔여 물리 버그 (C)
- B/H 해결 후에도 남으면 진단
- resolveAgentOverlap, clampToPolygon 경계 케이스 점검

**완료 조건**: 벽 끼임 0건

---

### Phase 3 — 흐름/균형 (I, J)
- I: spawn weight 균등화, exit 선택을 거리 기반 → 혼잡도 포함
- J: passWeight 재조정 or hub 중간 삽입

**완료 조건**: Entry/Exit 45–55% 범위, peak edge < 70%

---

### Phase 4 — 라우팅 튜닝 (D)
- Phase 1-3 해결 후 피로도 decay rate, mustVisit dwell 매트릭스 재측정
- 히어로 완주율 목표: ≥ 30%

---

### Phase 5 — 리포트/UX (E, F, G)
- 완주율 정의 변경 (≥3존 → ≥90% 관람)
- 미디어 이름 출력
- 차트 y축 autoscale

---

## 4. 작업 규칙

- **한 Phase 완료 → 시뮬 테스트 → 커밋** (CLAUDE.md 원칙 준수)
- Phase 내부도 세부 작업 하나씩 검증
- 지표는 매 Phase 종료 시 비교표 업데이트
- 예상과 다르면 **가설부터 재검토**, 우회책 금지 (feedback_no_overlap_tolerance 참조)

---

## 5. 진행 로그

| 날짜 | Phase | 상태 | 비고 |
|------|-------|------|------|
| 2026-04-22 | — | 계획 수립 | 이 문서 작성 |
