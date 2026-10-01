import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { app } from './firebase';

// Authentication does not use RTDB. Initialize it when a room or projection loads.
export const realtimeDb = getDatabase(app);
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
    const emulatorUrl = import.meta.env.VITE_REALTIME_DATABASE_EMULATOR_URL;
    const endpoint = emulatorUrl ? new URL(emulatorUrl) : null;
    connectDatabaseEmulator(realtimeDb, endpoint?.hostname || 'localhost', Number(endpoint?.port || 9000));
}
