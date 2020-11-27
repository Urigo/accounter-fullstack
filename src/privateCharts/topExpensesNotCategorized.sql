select * from top_expenses_not_categorized('2020-10-01');

drop function top_expenses_not_categorized;
CREATE OR REPLACE FUNCTION top_expenses_not_categorized(month_input varchar)
    RETURNS TABLE
            (
                amount           numeric,
                date             date,
                description      text,
                bank_description text,
                currency_code    text,
                event_number    bigint
            )
    LANGUAGE SQL
AS
$$

select abs(event_amount),
       event_date,
       user_description,
       bank_description,
       currency_code,
       event_number
from formatted_merged_tables
where (personal_category is null or
         personal_category = '')
--         AND event_amount < 0
    and event_date::text::date >= month_input::date
   --       AND event_date::text::date <= '2019-12-31'
   or event_date is null
order by abs(event_amount) desc nulls last;

$$;