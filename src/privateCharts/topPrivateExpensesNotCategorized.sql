select * from top_private_expenses_not_categorized;

CREATE OR REPLACE VIEW top_private_expenses_not_categorized AS
SELECT ABS(event_amount),
       event_date,
       user_description
FROM formatted_merged_tables
WHERE (account_number = 9217 OR account_number = 410915)
  AND (personal_category IS NULL OR
       personal_category = '')
--         AND event_amount < 0
  --       event_date::text::date >= '2019-12-01' AND
  --       event_date::text::date <= '2019-12-31' OR
  --       event_date IS NULL
ORDER BY ABS(event_amount) DESC NULLS LAST;