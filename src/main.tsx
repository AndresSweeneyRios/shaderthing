import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { Shader } from "./views/Shader"

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Shader />
  </React.StrictMode>
)
