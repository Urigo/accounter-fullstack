import { Notification } from '@mantine/core';
import { showNotification, updateNotification } from '@mantine/notifications';
import { Check, X } from 'tabler-icons-react';

export interface Props {
  title?: string;
  content?: string;
  state?: 'success' | 'error';
}

export const NotificationPopUp = ({ title, content, state }: Props) => {
  return (
    <Notification
      disallowClose
      style={{ zIndex: 9999, position: 'absolute', left: 0, top: 0 }}
      icon={state === 'success' ? <Check size={18} /> : <X size={18} />}
      color={state}
      title={title}
      onClick={() => {
        showNotification({
          id: 'load-data',
          loading: true,
          title: 'Loading your data',
          message: 'Data will be loaded in 3 seconds, you cannot close this yet',
          autoClose: false,
          disallowClose: true,
        });

        setTimeout(() => {
          updateNotification({
            id: 'load-data',
            color: 'teal',
            title: 'Data was loaded',
            message: 'Notification will close in 2 seconds, you can close this notification now',
            icon: <Check />,
            autoClose: 2000,
          });
        }, 3000);
      }}
    >
      {content}
    </Notification>
  );
};
