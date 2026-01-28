import { createContext, useContext } from 'react'

export interface UserInfo {
  username?: string
  email?: string
  givenName?: string
  familyName?: string
  roles?: string[]
  sub?: string
  iss?: string
  aud?: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

export interface UserContextType {
  user: UserInfo | null
  loading: boolean
}

export const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
})

export const useUser = () => useContext(UserContext)
