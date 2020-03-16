drop function top_private_expenses_not_categorized;
CREATE OR REPLACE FUNCTION top_private_expenses_not_categorized(month_input varchar)
    RETURNS TABLE
            (
                amount           numeric,
                date             date,
                description      text,
                bank_description text,
                currency_code    text
            )
    LANGUAGE SQL
AS
$$

select abs(event_amount),
       event_date,
       user_description,
       bank_description,
       currency_code
from formatted_merged_tables
where (account_number = 9217 or account_number = 410915)
    and (personal_category is null or
         personal_category = '')
--         AND event_amount < 0
    and event_date::text::date >= month_input::date
   --       AND event_date::text::date <= '2019-12-31'
   or event_date is null
order by abs(event_amount) desc nulls last;

$$;