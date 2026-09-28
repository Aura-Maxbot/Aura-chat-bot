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

const AdminScreen = ({ companyName, fullName, companyId, staffId }) => {
    const companyInitial = companyName ? companyName.trim()[0].toUpperCase() : '?';

    const [showAdd, setShowAdd] = useState(false);
    const [roleInput, setRoleInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [nameInput, setNameInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const staff = []; // заменим позже на реальный список

    const handleAdd = async () => {
        if (!roleInput.trim()) {
            setError('Введите должность');
            return;
        }
        if (!phoneInput.trim()) {
            setError('Введите номер телефона');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await addStaff(
                companyId,
                roleInput.trim(),
                phoneInput.trim(),
                nameInput.trim() || null,
            );
            console.log('Ответ addStaff:', data);

            if (!data.ok) {
                setError(data.error || 'Не удалось добавить сотрудника');
                return;
            }
            setSuccess(true);
            setRoleInput('');
            setPhoneInput('');
            setNameInput('');
            setTimeout(() => {
                setSuccess(false);
                setShowAdd(false);
            }, 1500);
        } catch (err) {
            console.error('Ошибка addStaff:', err);
            setError('Сервис недоступен');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setShowAdd(false);
        setError(null);
        setRoleInput('');
        setPhoneInput('');
        setNameInput('');
        setSuccess(false);
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
                            {member.role}
                        </CellSimple>
                    ))}
                </CellList>

                {/* Кнопка "Добавить сотрудника" */}
                {!showAdd && (
                    <Button
                        appearance="themed"
                        mode="primary"
                        size="medium"
                        onClick={() => setShowAdd(true)}
                    >
                        Добавить сотрудника
                    </Button>
                )}

                {/* Форма добавления */}
                {showAdd && (
                    <Flex direction="column" gap={12}>
                        <Flex direction="column" gap={4}>
                        </Flex>

                        <Flex direction="column" gap={4}>
                            <Typography.Text>Должность</Typography.Text>
                            <input
                                type="text"
                                value={roleInput}
                                onChange={(e) => setRoleInput(e.target.value)}
                                placeholder="Например: Диспетчер"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #d9d9d9',
                                    fontSize: 16,
                                    background: '#fff',
                                    outline: 'none',
                                }}
                            />
                        </Flex>

                        <Flex direction="column" gap={4}>
                            <Typography.Text>Телефон</Typography.Text>
                            <input
                                type="tel"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                placeholder="+7 999 000-00-00"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #d9d9d9',
                                    fontSize: 16,
                                    background: '#fff',
                                    outline: 'none',
                                }}
                            />
                        </Flex>

                        {error && (
                            <Typography.Text style={{ color: 'red' }}>
                                {error}
                            </Typography.Text>
                        )}
                        {success && (
                            <Typography.Text style={{ color: 'green' }}>
                                Сотрудник добавлен
                            </Typography.Text>
                        )}

                        <Flex direction="row" gap={8}>
                            <Button
                                appearance="themed"
                                mode="primary"
                                size="medium"
                                onClick={handleAdd}
                                disabled={loading}
                            >
                                {loading ? 'Добавление...' : 'Добавить'}
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

            </Grid>
        </Panel>
    );
};

export default AdminScreen;