\set round_id 30000001

\echo '==== 1) EXECUTION / LOG CHECK ===='
SELECT log_type_id, MAX(timestamp) AS last_run
FROM dw.update_log
WHERE log_type_id IN (1,2)
GROUP BY log_type_id
ORDER BY log_type_id;

\echo '==== 2) REQUIRED ROUND/CONTEST EXISTS IN DW ===='
SELECT pr.id AS public_round_id, dr.id AS dw_round_id, dr.contest_id, dc.id AS dw_contest_id
FROM public.round pr
LEFT JOIN dw.round dr ON dr.id = pr.id
LEFT JOIN dw.contest dc ON dc.id = dr.contest_id
WHERE pr.id = :round_id;

\echo '==== 3) long_comp_result KEY PARITY (should return 0 rows) ===='
WITH excluded AS (
  SELECT DISTINCT user_id FROM public.user_group_xref WHERE group_id IN (2000115,13)
),
src AS (
  SELECT rr.round_id::int AS round_id, rr.coder_id::int AS coder_id
  FROM public.long_comp_result rr
  WHERE rr.round_id = :round_id
    AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.user_id = rr.coder_id)
),
dwk AS (
  SELECT lcr.round_id::int AS round_id, lcr.coder_id::int AS coder_id
  FROM dw.long_comp_result lcr
  WHERE lcr.round_id = :round_id
)
SELECT 'missing_in_dw' AS issue, s.round_id, s.coder_id
FROM (SELECT * FROM src EXCEPT SELECT * FROM dwk) s
UNION ALL
SELECT 'extra_in_dw' AS issue, d.round_id, d.coder_id
FROM (SELECT * FROM dwk EXCEPT SELECT * FROM src) d
ORDER BY issue, coder_id;

\echo '==== 4) old_rating_id/new_rating_id RULE CHECK (should return 0 rows) ===='
SELECT round_id, coder_id, old_rating, old_rating_id, new_rating, new_rating_id
FROM dw.long_comp_result
WHERE round_id = :round_id
  AND (
    (COALESCE(old_rating,0)=0 AND old_rating_id IS DISTINCT FROM -2) OR
    (COALESCE(old_rating,0)<>0 AND old_rating_id IS DISTINCT FROM old_rating) OR
    (COALESCE(new_rating,0)=0 AND new_rating_id IS DISTINCT FROM -2) OR
    (COALESCE(new_rating,0)<>0 AND new_rating_id IS DISTINCT FROM new_rating)
  );

\echo '==== 5) provisional_placed TIE LOGIC CHECK (should return 0 rows) ===='
WITH attended AS (
  SELECT coder_id,
         DENSE_RANK() OVER (ORDER BY point_total DESC NULLS LAST) AS expected_rank
  FROM dw.long_comp_result
  WHERE round_id = :round_id
    AND attended = 'Y'
),
chk AS (
  SELECT lcr.coder_id, lcr.attended, lcr.point_total, lcr.provisional_placed, a.expected_rank
  FROM dw.long_comp_result lcr
  LEFT JOIN attended a ON a.coder_id = lcr.coder_id
  WHERE lcr.round_id = :round_id
)
SELECT *
FROM chk
WHERE (attended = 'Y' AND provisional_placed IS DISTINCT FROM expected_rank)
   OR (attended <> 'Y' AND provisional_placed IS NOT NULL);

\echo '==== 6) num_ratings PARITY CHECK (should return 0 rows) ===='
WITH cur_round AS (
  SELECT r.id, r.rating_order, r.round_type_id
  FROM dw.round r
  WHERE r.id = :round_id
),
prev AS (
  SELECT lcr.coder_id, MAX(COALESCE(lcr.num_ratings,0))::int AS prev_num
  FROM dw.long_comp_result lcr
  JOIN dw.round r ON r.id = lcr.round_id
  JOIN dw.round_type_lu rt ON rt.id = r.round_type_id
  JOIN cur_round cr ON TRUE
  JOIN dw.round_type_lu crt ON crt.id = cr.round_type_id
  WHERE r.rating_order < cr.rating_order
    AND rt.algo_rating_type_id = crt.algo_rating_type_id
  GROUP BY lcr.coder_id
)
SELECT c.coder_id, c.rated, c.num_ratings,
       COALESCE(p.prev_num,0) + CASE WHEN c.rated = 1 THEN 1 ELSE 0 END AS expected_num_ratings
FROM dw.long_comp_result c
LEFT JOIN prev p ON p.coder_id = c.coder_id
WHERE c.round_id = :round_id
  AND c.num_ratings IS DISTINCT FROM (COALESCE(p.prev_num,0) + CASE WHEN c.rated = 1 THEN 1 ELSE 0 END);

\echo '==== 6b) num_submissions JAVA PARITY CHECK (should return 0 rows) ===='
WITH excluded AS (
  SELECT DISTINCT user_id FROM public.user_group_xref WHERE group_id IN (2000115,13)
),
src AS (
  SELECT
    rr.round_id::int AS round_id,
    rr.coder_id::int AS coder_id,
    lcs.submission_number::int AS num_submissions
  FROM public.long_comp_result rr
  JOIN public.round_component rc
    ON rc.round_id = rr.round_id
  JOIN public.long_component_state lcs
    ON lcs.round_id = rr.round_id
   AND lcs.coder_id = rr.coder_id
   AND lcs.component_id = rc.component_id
  WHERE rr.round_id = :round_id
    AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.user_id = rr.coder_id)
),
dwk AS (
  SELECT
    lcr.round_id::int AS round_id,
    lcr.coder_id::int AS coder_id,
    lcr.num_submissions::int AS num_submissions
  FROM dw.long_comp_result lcr
  WHERE lcr.round_id = :round_id
)
SELECT
  COALESCE(s.coder_id, d.coder_id) AS coder_id,
  s.num_submissions AS expected_num_submissions,
  d.num_submissions AS actual_num_submissions
FROM src s
FULL OUTER JOIN dwk d
  ON d.round_id = s.round_id
 AND d.coder_id = s.coder_id
WHERE s.num_submissions IS DISTINCT FROM d.num_submissions
ORDER BY coder_id;

\echo '==== 7) system_test_case KEY PARITY (should return 0 rows) ===='
WITH src AS (
  SELECT stc.component_id::int, stc.test_case_id::int
  FROM public.system_test_case stc
  JOIN public.round_component rc ON rc.component_id = stc.component_id
  WHERE rc.round_id = :round_id
),
dwk AS (
  SELECT stc.component_id::int, stc.test_case_id::int
  FROM dw.system_test_case stc
  WHERE stc.component_id IN (
    SELECT component_id FROM dw.round_component WHERE round_id = :round_id
  )
)
SELECT 'missing_in_dw' AS issue, s.component_id, s.test_case_id
FROM (SELECT * FROM src EXCEPT SELECT * FROM dwk) s
UNION ALL
SELECT 'extra_in_dw' AS issue, d.component_id, d.test_case_id
FROM (SELECT * FROM dwk EXCEPT SELECT * FROM src) d
ORDER BY issue, component_id, test_case_id;

\echo '==== 8) long_system_test_result KEY PARITY (should return 0 rows) ===='
WITH excluded AS (
  SELECT DISTINCT user_id FROM public.user_group_xref WHERE group_id IN (2000115,13)
),
src AS (
  SELECT str.round_id::int, str.coder_id::int, str.component_id::int, str.test_case_id::int, str.submission_number::int
  FROM public.long_system_test_result str
  WHERE str.round_id = :round_id
    AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.user_id = str.coder_id)
),
dwk AS (
  SELECT l.round_id::int, l.coder_id::int, l.component_id::int, l.test_case_id::int, l.submission_number::int
  FROM dw.long_system_test_result l
  WHERE l.round_id = :round_id
)
SELECT 'missing_in_dw' AS issue, *
FROM (SELECT * FROM src EXCEPT SELECT * FROM dwk) x
UNION ALL
SELECT 'extra_in_dw' AS issue, *
FROM (SELECT * FROM dwk EXCEPT SELECT * FROM src) y
ORDER BY issue, coder_id, component_id, test_case_id, submission_number;

\echo '==== 9) long_problem_submission KEY PARITY (should return 0 rows) ===='
WITH excluded AS (
  SELECT DISTINCT user_id FROM public.user_group_xref WHERE group_id IN (2000115,13)
),
src AS (
  SELECT
    cs.round_id::int,
    cs.coder_id::int,
    cs.component_id::int,
    COALESCE(s.submission_number, cs.submission_number)::int AS submission_number,
    COALESCE(s.example,0)::int AS example
  FROM public.long_component_state cs
  LEFT JOIN public.long_submission s
    ON s.round_id = cs.round_id
   AND s.coder_id = cs.coder_id
   AND s.component_id = cs.component_id
   AND s.submission_number = cs.submission_number
  WHERE cs.round_id = :round_id
    AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.user_id = cs.coder_id)
    AND COALESCE(s.submission_number, cs.submission_number) IS NOT NULL
),
dwk AS (
  SELECT round_id::int, coder_id::int, component_id::int, submission_number::int, example::int
  FROM dw.long_problem_submission
  WHERE round_id = :round_id
)
SELECT 'missing_in_dw' AS issue, *
FROM (SELECT * FROM src EXCEPT SELECT * FROM dwk) x
UNION ALL
SELECT 'extra_in_dw' AS issue, *
FROM (SELECT * FROM dwk EXCEPT SELECT * FROM src) y
ORDER BY issue, coder_id, component_id, submission_number, example;

\echo '==== 10) problem_category_xref PARITY (should return 0 rows) ===='
WITH src AS (
  SELECT DISTINCT psrc.problem_id::int, psrc.category_id::int
  FROM public.problem_category_xref psrc
  JOIN public.component c ON c.problem_id = psrc.problem_id
  JOIN public.round_component rc ON rc.component_id = c.id
  WHERE rc.round_id = :round_id
    AND c.problem_id IS NOT NULL
),
dwk AS (
  SELECT problem_id::int, category_id::int
  FROM dw.problem_category_xref
  WHERE problem_id IN (
    SELECT DISTINCT c.problem_id
    FROM dw.round_component rc
    JOIN dw.component c ON c.id = rc.component_id
    WHERE rc.round_id = :round_id
      AND c.problem_id IS NOT NULL
  )
)
SELECT 'missing_in_dw' AS issue, *
FROM (SELECT * FROM src EXCEPT SELECT * FROM dwk) x
UNION ALL
SELECT 'extra_in_dw' AS issue, *
FROM (SELECT * FROM dwk EXCEPT SELECT * FROM src) y
ORDER BY issue, problem_id, category_id;

\echo '==== 11) ADMIN EXCLUSION LEAK CHECK (all leak_count should be 0) ===='
WITH excluded AS (
  SELECT DISTINCT user_id FROM public.user_group_xref WHERE group_id IN (2000115,13)
)
SELECT 'dw.long_comp_result' AS table_name, COUNT(*) AS leak_count
FROM dw.long_comp_result t
WHERE t.round_id = :round_id
  AND EXISTS (SELECT 1 FROM excluded e WHERE e.user_id = t.coder_id)
UNION ALL
SELECT 'dw.long_problem_submission', COUNT(*)
FROM dw.long_problem_submission t
WHERE t.round_id = :round_id
  AND EXISTS (SELECT 1 FROM excluded e WHERE e.user_id = t.coder_id)
UNION ALL
SELECT 'dw.long_system_test_result', COUNT(*)
FROM dw.long_system_test_result t
WHERE t.round_id = :round_id
  AND EXISTS (SELECT 1 FROM excluded e WHERE e.user_id = t.coder_id);

\echo '==== 12) DUPLICATE CHECK (all duplicate_groups should be 0) ===='
SELECT 'long_comp_result' AS table_name, COUNT(*) AS duplicate_groups
FROM (
  SELECT round_id, coder_id, COUNT(*) c
  FROM dw.long_comp_result
  WHERE round_id = :round_id
  GROUP BY round_id, coder_id
  HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'long_problem_submission', COUNT(*)
FROM (
  SELECT round_id, coder_id, component_id, submission_number, example, COUNT(*) c
  FROM dw.long_problem_submission
  WHERE round_id = :round_id
  GROUP BY round_id, coder_id, component_id, submission_number, example
  HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'long_system_test_result', COUNT(*)
FROM (
  SELECT round_id, coder_id, component_id, test_case_id, submission_number, COUNT(*) c
  FROM dw.long_system_test_result
  WHERE round_id = :round_id
  GROUP BY round_id, coder_id, component_id, test_case_id, submission_number
  HAVING COUNT(*) > 1
) t;

\echo '==== 13) loadCoders DW RELATION INTEGRITY (all broken_count should be 0) ===='
SELECT 'coder_without_user' AS check_name, COUNT(*) AS broken_count
FROM dw.coder c LEFT JOIN dw."user" u ON u.id = c.user_id
WHERE u.id IS NULL
UNION ALL
SELECT 'coder_skill_without_coder_or_skill', COUNT(*)
FROM dw.coder_skill_xref x
LEFT JOIN dw.coder c ON c.id = x.coder_id
LEFT JOIN dw.skill s ON s.skill_id = x.skill_id
WHERE c.id IS NULL OR s.skill_id IS NULL
UNION ALL
SELECT 'coder_image_without_coder_or_image', COUNT(*)
FROM dw.coder_image_xref x
LEFT JOIN dw.coder c ON c.id = x.coder_id
LEFT JOIN dw.image i ON i.image_id = x.image_id
WHERE c.id IS NULL OR i.image_id IS NULL
UNION ALL
SELECT 'image_without_path', COUNT(*)
FROM dw.image i
LEFT JOIN dw.path p ON p.path_id = i.path_id
WHERE p.path_id IS NULL
UNION ALL
SELECT 'current_school_without_coder_or_school', COUNT(*)
FROM dw.current_school cs
LEFT JOIN dw.coder c ON c.id = cs.coder_id
LEFT JOIN dw.school s ON s.school_id = cs.school_id
WHERE c.id IS NULL OR s.school_id IS NULL
UNION ALL
SELECT 'user_achievement_without_user_or_type', COUNT(*)
FROM dw.user_achievement ua
LEFT JOIN dw."user" u ON u.id = ua.user_id
LEFT JOIN dw.achievement_type_lu a ON a.achievement_type_id = ua.achievement_type_id
WHERE u.id IS NULL OR a.achievement_type_id IS NULL
UNION ALL
SELECT 'team_coder_without_team_or_user', COUNT(*)
FROM dw.team_coder_xref tx
LEFT JOIN dw.team t ON t.team_id = tx.team_id
LEFT JOIN dw."user" u ON u.id = tx.coder_id
WHERE t.team_id IS NULL OR u.id IS NULL
UNION ALL
SELECT 'event_registration_without_event_or_user', COUNT(*)
FROM dw.event_registration er
LEFT JOIN dw.event e ON e.event_id = er.event_id
LEFT JOIN dw."user" u ON u.id = er.user_id
WHERE e.event_id IS NULL OR u.id IS NULL;

\echo '==== 14) RANK TABLE SNAPSHOT (for manual sanity) ===='
SELECT 'coder_rank' AS table_name, coder_rank_type_id, COUNT(*) AS rows
FROM dw.coder_rank
WHERE algo_rating_type_id = 3
GROUP BY coder_rank_type_id
UNION ALL
SELECT 'coder_rank_history', coder_rank_type_id, COUNT(*)
FROM dw.coder_rank_history
WHERE round_id = :round_id AND algo_rating_type_id = 3
GROUP BY coder_rank_type_id
UNION ALL
SELECT 'country_coder_rank', coder_rank_type_id, COUNT(*)
FROM dw.country_coder_rank
WHERE algo_rating_type_id = 3
GROUP BY coder_rank_type_id
UNION ALL
SELECT 'state_coder_rank', coder_rank_type_id, COUNT(*)
FROM dw.state_coder_rank
WHERE algo_rating_type_id = 3
GROUP BY coder_rank_type_id
UNION ALL
SELECT 'school_coder_rank', coder_rank_type_id, COUNT(*)
FROM dw.school_coder_rank
WHERE algo_rating_type_id = 3
GROUP BY coder_rank_type_id
ORDER BY table_name, coder_rank_type_id;
