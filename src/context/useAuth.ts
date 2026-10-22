import { useContext } from 'react';
import { AuthContext } from './authDefinition';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { UserProfile, TeamMember, CloudNotification, AuthContextType } from './authDefinition';
