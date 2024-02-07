import { ChangeEvent, FormEvent, ReactElement, useEffect, useState } from 'react';
import { type Location, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Loader, PasswordInput, TextInput } from '@mantine/core';
import { userService } from '../services/user-service';

type StateProps = {
  message?: string;
};

export const LoginPage = (): ReactElement => {
  useEffect(() => {
    userService.logout();
  }, []);

  const location: Location<StateProps> = useLocation();
  const {message = ''} = location.state ?? {};

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(message);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    switch (name) {
      case 'username':
        setUsername(value);
        break;
      case 'password':
        setPassword(value);
        break;
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();

    setSubmitted(true);

    // stop here if form is invalid
    if (!(username && password)) {
      setError(error);
      return;
    }

    setLoading(true);
    userService.login(username, password).then(
      _user => {
        navigate('/');
      },
      error => {
        setError(error);
        setLoading(false);
      },
    );
  }

  return (
    <div className="flex flex-row justify-center">
      <form name="login" onSubmit={handleSubmit} className="p-8 max-w-96">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <TextInput
            size="sm"
            name="username"
            value={username}
            onChange={handleChange}
            label="Username"
            placeholder="username"
            error={submitted && !username ? 'Username is required' : undefined}
          />

          <PasswordInput
            name="password"
            value={password}
            onChange={handleChange}
            label="Password"
            placeholder="password"
            error={submitted && !password ? 'Password is required' : undefined}
          />

          <Button
            variant="outline"
            color="blue"
            fullWidth
            mt="md"
            radius="md"
            type="submit"
            rightIcon={loading ? <Loader /> : undefined}
          >
            Login
          </Button>

          {error && <div className="alert alert-danger">{error}</div>}
        </Card>
      </form>
    </div>
  );
};
