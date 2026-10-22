// FE-16: the CRA "learn react" stub could never pass against this app.
// Replaced with a real smoke test: the Navbar (rendered on every page)
// mounts inside the auth context and router without crashing.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './services/AuthContext';
import Navbar from './components/Navbar';

test('navbar renders for an anonymous visitor', () => {
  render(
    <AuthProvider>
      <MemoryRouter>
        <Navbar toggleChat={() => {}} />
      </MemoryRouter>
    </AuthProvider>
  );
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
