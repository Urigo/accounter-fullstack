SELECT *
FROM get_tax_report_of_month('2020-03-01')
WHERE
    ((מטח_סכום_חובה_1 IS NOT NULL AND מטח_סכום_חובה_1 <> '' AND
    סכום_חובה_1 IS NULL) OR
    (מטח_סכום_חובה_2 IS NOT NULL AND מטח_סכום_חובה_2 <> '' AND
    סכום_חובה_2 IS NULL) OR
    (מטח_סכום_זכות_1 IS NOT NULL AND מטח_סכום_זכות_1 <> '' AND
    סכום_זכות_1 IS NULL) OR
    (מטח_סכום_זכות_2 IS NOT NULL AND מטח_סכום_זכות_2 <> '' AND
    סכום_זכות_2 IS NULL));