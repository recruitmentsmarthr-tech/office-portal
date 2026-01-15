import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';

test('renders login form', () => {
  render(
    <BrowserRouter>
      <Login onLogin={() => {}} />
    </BrowserRouter>
  );
  expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
});
