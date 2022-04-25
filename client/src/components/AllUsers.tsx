import { FC, useEffect, useState } from 'react';
import { businesses } from '../helpers';
import { useSql } from '../hooks/useSql';

export const AllUsers: FC = () => {
  const { getAllUsers } = useSql();
  const [users, setUsers] = useState<{ username: string }[]>([]);

  // TODO: set company from UI
  // TODO: get ALL users, or from current company? NULL will fetch all of them.
  const companyId = businesses['Software Products Guilda Ltd.'];

  useEffect(() => {
    getAllUsers(companyId).then(setUsers);
  }, []);

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
