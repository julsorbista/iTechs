import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import SuperAdminPage from './SuperAdminPage'

const {
  mockNavigate,
  mockLogout,
  getUsersMock,
  createUserMock,
  updateUserMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogout: vi.fn(),
  getUsersMock: vi.fn(),
  createUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'super-admin-1',
      role: 'SUPER_ADMIN',
      username: 'admin@itechs.com',
      firstName: 'Ada',
    },
    logout: mockLogout,
  }),
}))

vi.mock('../utils/api', () => ({
  userAPI: {
    getUsers: getUsersMock,
    createUser: createUserMock,
    updateUser: updateUserMock,
  },
  adminAiAPI: {
    generateQuestion: vi.fn(),
  },
  handleAPIError: (error) => ({
    message: error?.message || 'Unknown error',
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}))

describe('SuperAdminPage smoke flow', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockLogout.mockReset()
    getUsersMock.mockReset()
    createUserMock.mockReset()
    updateUserMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()

    getUsersMock.mockResolvedValue({
      status: 'success',
      data: {
        users: [],
      },
    })
  })

  const renderPage = async () => {
    render(
      <MemoryRouter>
        <SuperAdminPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(getUsersMock).toHaveBeenCalled()
    })
  }

  it('does not expose an admin level editor action', async () => {
    await renderPage()

    expect(screen.queryByRole('button', { name: /open level editor/i })).not.toBeInTheDocument()
  })

  it('does not render the old second-step fullscreen editor CTA', async () => {
    await renderPage()

    expect(screen.queryByText(/open full screen editor/i)).not.toBeInTheDocument()
  })
})
