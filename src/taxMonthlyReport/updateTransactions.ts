import { pool } from '..';

export async function updateBankTransactionAttribute(transactionId: string, attribute: string, value: string) {
  const updateQuery = `
          update accounter_schema.ledger
          set ${attribute} = $1
          where id = $2;
        `;

  try {
    const result = await pool.query(updateQuery, [value, transactionId]);
    return result;
  } catch (error) {
    console.log('error in DB - ', error);
  }
}
