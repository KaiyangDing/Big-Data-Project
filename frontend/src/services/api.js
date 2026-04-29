import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
})

export const getAnalysis = (name) => api.get(`/api/analysis/${name}`).then(r => r.data)
export const getAirports = (params) => api.get('/api/airports', { params }).then(r => r.data)
export const getCarriers = () => api.get('/api/carriers').then(r => r.data)
export const getRoute = (origin, dest) => api.get(`/route/${origin}/${dest}`).then(r => r.data)
export const predictPre = (body) => api.post('/predict/pre', body).then(r => r.data)
export const predictPost = (body) => api.post('/predict/post', body).then(r => r.data)
