SELECT
       SUM((CASE WHEN סכום_זכות_2 = '' THEN '0' ELSE סכום_זכות_2 END)::numeric),
       SUM((CASE WHEN סכום_חובה_2 = '' THEN '0' ELSE סכום_חובה_2 END)::numeric)
FROM get_tax_report_of_month('2020-03-01');