import { useState } from 'react';
import {
    Panel,
    Flex,
    Grid,
    Container,
    Typography,
    Avatar,
    CellList,
    CellHeader,
    CellSimple,
    Button,
} from '@maxhub/max-ui';
import { addStaff } from '../api.js';

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Председатель' },
    { value: 'dispatcher', label: 'Диспетчер' },
    { value: 'main_dispatcher', label: 'Главный диспетчер' },
];

const ROLE_LABELS = {
    admin: 'Председатель',
    dispatcher: 'Диспетчер',
    main_dispatcher: 'Главный диспетчер',
};

const AdminScreen = ({ companyName, fullName, companyId, staffId }) => {
    const companyInitial = companyName ? companyName.trim()[0].toUpperCase() : '?';

    const [showAdd, setShowAdd] = useState(false);
    const [role, setRole] = useState('dispatcher');
    const [code, setCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const staff = []; // заменим позже на реальный список

    const handleGetCode = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await addStaff(companyId, role, staffId);
            console.log('Ответ addStaff:', data);
            if (!data.ok) {
                setError(data.error || 'Не удалось создать сотрудника');
                return;
            }
            setCode(data.code);
        } catch (err) {
            console.error('Ошибка addStaff:', err);
            setError('Сервис недоступен');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setShowAdd(false);
        setCode(null);
        setError(null);
        setRole('dispatcher');
    };

    return (
        <Panel mode="secondary" style={{ minHeight: '100vh' }}>
            <Grid gap={16} cols={1} style={{ padding: 16 }}>

                {/* Шапка профиля */}
                <Container>
                    <Flex direction="row" align="center" gap={12}>
                        <Avatar.Container size={56} form="squircle" gradient="blue">
                            <Avatar.Text>{companyInitial}</Avatar.Text>
                        </Avatar.Container>
                        <Flex direction="column">
                            <Typography.Title>
                                {companyName || 'Управляющая компания'}
                            </Typography.Title>
                            <Typography.Text>
                                {fullName || 'Имя Фамилия'} — Председатель
                            </Typography.Text>
                        </Flex>
                    </Flex>
                </Container>

                {/* Список сотрудников */}
                <CellList
                    header={<CellHeader titleStyle="caps">Сотрудники</CellHeader>}
                    mode="island"
                >
                    {staff.map((member) => (
                        <CellSimple
                            key={member.id}
                            before={
                                <Avatar.Container size={40}>
                                    {member.avatar ? (
                                        <Avatar.Image src={member.avatar} />
                                    ) : (
                                        <Avatar.Text>
                                            {member.full_name?.[0]?.toUpperCase() || '?'}
                                        </Avatar.Text>
                                    )}
                                </Avatar.Container>
                            }
                            onClick={() => {}}
                            showChevron
                            title={member.full_name}
                        >
                            {ROLE_LABELS[member.role] || member.role}
                        </CellSimple>
                    ))}
                </CellList>

                {/* Блок добавления сотрудника */}
                {!showAdd && !code && (
                    <Button
                        appearance="themed"
                        mode="primary"
                        size="medium"
                        onClick={() => setShowAdd(true)}
                    >
                        Добавить сотрудника
                    </Button>
                )}

                {showAdd && !code && (
                    <Flex direction="column" gap={12}>
                        <Flex direction="column" gap={4}>
                            <Typography.Text>Должность</Typography.Text>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #d9d9d9',
                                    fontSize: 16,
                                    background: '#fff',
                                }}
                            >
                                {ROLE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </Flex>
                        {error && (
                            <Typography.Text style={{ color: 'red' }}>
                                {error}
                            </Typography.Text>
                        )}
                        <Flex direction="row" gap={8}>
                            <Button
                                appearance="themed"
                                mode="primary"
                                size="medium"
                                onClick={handleGetCode}
                                disabled={loading}
                            >
                                {loading ? 'Генерация...' : 'Получить код'}
                            </Button>
                            <Button
                                appearance="neutral"
                                mode="secondary"
                                size="medium"
                                onClick={handleReset}
                            >
                                Отмена
                            </Button>
                        </Flex>
                    </Flex>
                )}

                {code && (
                    <Flex direction="column" gap={12}>
                        <Typography.Text>Код для сотрудника:</Typography.Text>
                        <Container
                            style={{
                                padding: 16,
                                background: '#f2f3f5',
                                borderRadius: 12,
                                textAlign: 'center',
                            }}
                        >
                            <Typography.Title>{code}</Typography.Title>
                        </Container>
                        <Button
                            appearance="neutral"
                            mode="secondary"
                            size="medium"
                            onClick={handleReset}
                        >
                            Готово
                        </Button>
                    </Flex>
                )}

            </Grid>
        </Panel>
    );
};

export default AdminScreen;