import { useEffect, useState } from 'react';
import { businesses } from '../helpers';
import { useSql } from '../hooks/use-sql';
import { AccounterTable } from './common';

export const AllUsers = () => {
  const { getAllUsers } = useSql();
  const [users, setUsers] = useState<{ username: string }[]>([]);

  // TODO: set company from UI
  // TODO: get ALL users, or from current company? NULL will fetch all of them.
  const companyId = businesses['Software Products Guilda Ltd.'];

  useEffect(() => {
    getAllUsers(companyId).then(setUsers);
  }, [getAllUsers, companyId]);

  return users.length ? (
    <>
      <h1>User Accounts List</h1>
      <AccounterTable
        items={users ?? []}
        columns={[{ title: 'שם חשבון', value: user => user.username }]}
      />
    </>
  ) : (
    <p>No user accounts found</p>
  );
};
