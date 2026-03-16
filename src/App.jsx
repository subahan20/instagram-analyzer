import { useState, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './components/Dashboard'
import InstagramSearch from './components/InstagramSearch'
import ProfilePage from './components/ProfilePage'

// Removed unused INITIAL_CATEGORIES array

function App() {
  return (
    <Routes>
      <Route path="/" element={<InstagramSearch />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
    </Routes>
  )
}

export default App
