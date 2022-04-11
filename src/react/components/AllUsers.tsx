import { FC } from 'react';
import { businesses } from '../helpers';
import { useSql } from '../hooks/useSql';

export const AllUsers: FC = () => {
  const { getAllUsers } = useSql();

  // TODO: set company from UI
  // TODO: get ALL users, or from current company? NULL will fetch all of them.
  const companyId = businesses['Uri Goldshtein LTD'];

  const users: { username: string }[] = getAllUsers(companyId) ?? [];

  return users.length ? (
    <>
      <h1>User Accounts List</h1>

      <table>
        <thead>
          <tr>
            <th>שם חשבון</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr>
              <td>{user.username}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  ) : (
    <p>No user accounts found</p>
  );
};
