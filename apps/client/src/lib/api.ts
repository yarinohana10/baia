import axios from 'axios';
import { publicApiUrl } from './api-urls';

// "/v1" (same-origin proxy) in production on Railway; the API origin in local dev.
export const api = axios.create({
  baseURL: publicApiUrl(),
  withCredentials: true,
});
