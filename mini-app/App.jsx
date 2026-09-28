import { useEffect, useState } from 'react';
import { Panel, Flex, Typography } from '@maxhub/max-ui';
import { fetchUserRole } from './api.js';
import LoadingScreen from './screens/LoadingScreen.jsx';
import RegisterScreen from './screens/RegisterScreen.jsx';
import AdminScreen from './screens/AdminScreen.jsx';

const App = () => {
    const [status, setStatus] = useState('loading');
    const [companyName, setCompanyName] = useState(null);
    const [fullName, setFullName] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [companyId, setCompanyId] = useState(null);
    const [staffId, setStaffId] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                if (!window.WebApp) {
                    throw new Error('MAX Bridge не загружен');
                }

                await window.WebApp.ready();

                const user = window.WebApp.initDataUnsafe?.user;
                const maxId = user?.id ?? user?.user_id;

                if (!maxId) {
                    throw new Error('Не удалось получить MAX ID пользователя');
                }

                console.log('MAX ID:', maxId);

                const data = await fetchUserRole(maxId);
                console.log('Ответ API:', data);

                if (data.found && data.role === 'admin') {
                    setCompanyName(data.company_name);
                    setFullName(data.full_name);
                    setStatus('admin');
                    setCompanyId(data.company_id);
                    setStaffId(data.staff_id);
                } else {
                    setStatus('register');
                }
            } catch (err) {
                console.error('Ошибка инициализации:', err);
                setErrorMessage(err.message);
                setStatus('error');
            }
        };

        init();
    }, []);

    if (status === 'loading') return <LoadingScreen />;
    if (status === 'register') return <RegisterScreen />;
    if (status === 'admin') return (
            <AdminScreen
                companyName={companyName}
                fullName={fullName}
                companyId={companyId}
                staffId={staffId}
            />
        );
    return (
        <Panel mode="secondary" style={{ minHeight: '100vh' }}>
            <Flex direction="column" align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
                <Typography.Title>Ошибка</Typography.Title>
                <Typography.Text style={{ marginTop: 12, textAlign: 'center' }}>
                    {errorMessage}
                </Typography.Text>
            </Flex>
        </Panel>
    );
};

export default App;