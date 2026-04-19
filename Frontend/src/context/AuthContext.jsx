import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../utils/api';

// Initial state
const initialState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  requiresOTP: false,
  otpEmail: null,
  otpUserId: null,
};

// Action types
const authActionTypes = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_REQUIRES_OTP: 'LOGIN_REQUIRES_OTP',
  OTP_VERIFIED: 'OTP_VERIFIED',
  LOGOUT: 'LOGOUT',
  UPDATE_USER: 'UPDATE_USER',
  CLEAR_OTP: 'CLEAR_OTP',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case authActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case authActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        requiresOTP: false,
        otpEmail: null,
        otpUserId: null,
      };

    case authActionTypes.LOGIN_REQUIRES_OTP:
      return {
        ...state,
        requiresOTP: true,
        otpEmail: action.payload.email,
        otpUserId: action.payload.userId,
        isLoading: false,
        isAuthenticated: false,
      };

    case authActionTypes.OTP_VERIFIED:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        requiresOTP: false,
        otpEmail: null,
        otpUserId: null,
        isLoading: false,
      };

    case authActionTypes.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };

    case authActionTypes.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case authActionTypes.CLEAR_OTP:
      return {
        ...state,
        requiresOTP: false,
        otpEmail: null,
        otpUserId: null,
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: authActionTypes.SET_LOADING, payload: true });
        
        const token = localStorage.getItem('authToken');
        const userString = localStorage.getItem('user');

        if (token && userString) {
          // Parse user data safely
          let parsedUser;
          try {
            parsedUser = JSON.parse(userString);
          } catch (parseError) {
            console.error('Failed to parse user data from localStorage:', parseError);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            dispatch({ type: authActionTypes.SET_LOADING, payload: false });
            return;
          }
          
          // Verify token is still valid by fetching user profile
          try {
            const response = await authAPI.getProfile();
            if (response.status === 'success') {
              dispatch({
                type: authActionTypes.LOGIN_SUCCESS,
                payload: {
                  user: response.data,
                  token,
                },
              });
            } else {
              // Token invalid, clear storage
              localStorage.removeItem('authToken');
              localStorage.removeItem('user');
              dispatch({ type: authActionTypes.SET_LOADING, payload: false });
            }
          } catch (profileError) {
            // Token invalid or expired, clear storage
            console.log('Token validation failed:', profileError.message);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            dispatch({ type: authActionTypes.SET_LOADING, payload: false });
          }
        } else {
          dispatch({ type: authActionTypes.SET_LOADING, payload: false });
        }
      } catch (error) {
        // Catch any unexpected errors
        console.error('Auth initialization error:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        dispatch({ type: authActionTypes.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: authActionTypes.SET_LOADING, payload: true });
      
      const response = await authAPI.login(credentials);
      
      if (response.status === 'success') {
        if (response.data.requiresOTP) {
          // Teacher needs OTP verification
          dispatch({
            type: authActionTypes.LOGIN_REQUIRES_OTP,
            payload: {
              email: response.data.email,
              userId: response.data.userId,
            },
          });
          dispatch({ type: authActionTypes.SET_LOADING, payload: false });
          return { requiresOTP: true };
        } else {
          // Direct login successful (student/super admin)
          const { token, user } = response.data;
          
          // Store in localStorage
          localStorage.setItem('authToken', token);
          localStorage.setItem('user', JSON.stringify(user));
          
          dispatch({
            type: authActionTypes.LOGIN_SUCCESS,
            payload: { user, token },
          });
          
          return { success: true, user };
        }
      } else {
        // Handle non-success response
        dispatch({ type: authActionTypes.SET_LOADING, payload: false });
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      dispatch({ type: authActionTypes.SET_LOADING, payload: false });
      throw error;
    }
  };

  // Verify OTP function
  const verifyOTP = async (email, otpCode) => {
    try {
      dispatch({ type: authActionTypes.SET_LOADING, payload: true });
      
      const response = await authAPI.verifyOTP({ email, otpCode });
      
      if (response.status === 'success') {
        const { token, user } = response.data;
        
        // Store in localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({
          type: authActionTypes.OTP_VERIFIED,
          payload: { user, token },
        });
        
        return { success: true, user };
      }
    } catch (error) {
      dispatch({ type: authActionTypes.SET_LOADING, payload: false });
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      // Clear localStorage and state
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      dispatch({ type: authActionTypes.LOGOUT });
    }
  };

  // Update user profile
  const updateUser = (userData) => {
    const updatedUser = { ...state.user, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    dispatch({
      type: authActionTypes.UPDATE_USER,
      payload: userData,
    });
  };

  // Clear OTP state
  const clearOTP = () => {
    dispatch({ type: authActionTypes.CLEAR_OTP });
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return state.user?.role === role;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    return roles.includes(state.user?.role);
  };

  const value = {
    // State
    ...state,
    
    // Functions
    login,
    logout,
    verifyOTP,
    updateUser,
    clearOTP,
    hasRole,
    hasAnyRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;