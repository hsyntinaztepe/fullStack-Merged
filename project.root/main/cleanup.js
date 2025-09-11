import { stopActiveStream } from './radarStream.js';

export function cleanup() {
  stopActiveStream();
}
