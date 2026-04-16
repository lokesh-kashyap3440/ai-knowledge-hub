import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// Mock the fetch API
global.fetch = vi.fn()

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders login screen by default when no token is present', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/Username/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument()
  })

  it('toggles between login and register modes', () => {
    render(<App />)
    const toggleButton = screen.getByRole('button', { name: /Need an account\?/i })
    fireEvent.click(toggleButton)
    
    expect(screen.getByPlaceholderText(/Confirm Password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument()
    
    const backToLogin = screen.getByRole('button', { name: /Have an account\?/i })
    fireEvent.click(backToLogin)
    expect(screen.queryByPlaceholderText(/Confirm Password/i)).not.toBeInTheDocument()
  })

  it('shows login explanation text', () => {
    render(<App />)
    expect(screen.getByText(/JWT authentication protects uploads/i)).toBeInTheDocument()
  })
})
