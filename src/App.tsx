import React, { Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InstallPromptBanner } from './components/modals/InstallPromptBanner';

const AuthView = React.lazy(() => import('./views/auth/AuthView').then(module => ({ default: module.AuthView })));
const AuthenticatedApp = React.lazy(() => import('./AuthenticatedApp'));
const BoardProjectionView = React.lazy(() => import('./views/board/BoardProjectionView').then(module => ({ default: module.BoardProjectionView })));

const Spinner = () => <div role="status" aria-label="載入中" className="flex-1 flex items-center justify-center bg-slate-950">
    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
</div>;

const AuthenticatedContent = ({ roomCode }: { roomCode: string | null }) => {
    const { user, isLoadingAuth } = useAuth();
    if (isLoadingAuth) return <Spinner />;
    return <Suspense fallback={<Spinner />}>
        {!user ? <AuthView /> : roomCode ? <BoardProjectionView roomCode={roomCode} /> : <AuthenticatedApp />}
    </Suspense>;
};

export default function App() {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.touchAction = 'none';
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.touchAction = '';
        };
    }, []);
    const roomCode = new URLSearchParams(window.location.search).get('boardRoom');
    return <AuthProvider>
        <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-950 select-none touch-none">
            <AuthenticatedContent roomCode={roomCode} />
            <InstallPromptBanner />
        </div>
    </AuthProvider>;
}
