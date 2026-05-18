'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(userId?: string, userName?: string, userRole?: string) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const getSocket = useCallback(() => socketRef.current, [])

  useEffect(() => {
    const socketInstance = io("/?XTransformPort=3003", {
      path: '/',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })

    socketRef.current = socketInstance

    socketInstance.on('connect', () => {
      setIsConnected(true)
      if (userId && userName) {
        socketInstance.emit('auth', { userId, name: userName, role: userRole || 'agent' })
      }
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
    })

    return () => {
      socketInstance.disconnect()
      socketRef.current = null
    }
  }, [userId, userName, userRole])

  return { getSocket, isConnected }
}
