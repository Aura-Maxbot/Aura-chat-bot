// TODO: Сделать связь с бэкендом для списка приглашенных сотрудников 
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

function formatPhone(value) {
    let digits = value.replace(/\D/g, '');

    if (digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }
    if (!digits.startsWith('7')) {
        digits = '7' + digits;
    }
    digits = digits.slice(0, 11);

    const d = digits.slice(1);

    let result = '+7';
    if (d.length > 0) result += ' (' + d.slice(0, 3);
    if (d.length >= 3) result += ')';
    if (d.length > 3) result += ' ' + d.slice(3, 6);
    if (d.length > 6) result += '-' + d.slice(6, 8);
    if (d.length > 8) result += '-' + d.slice(8, 10);

    return result;
}

const inputStyle = {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d9d9d9',
    fontSize: 16,
    background: '#fff',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
};

const AdminScreen = ({ companyName, fullName, companyId, staffId }) => {
    const companyInitial = companyName ? companyName.trim()[0].toUpperCase() : '?';

    const [staff, setStaff] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [roleInput, setRoleInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [nameInput, setNameInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleAdd = async () => {
        if (!nameInput.trim()) {
            setError('Введите ФИО');
            return;
        }
        if (!roleInput.trim()) {
            setError('Введите должность');
            return;
        }
        if (phoneInput.replace(/\D/g, '').length !== 11) {
            setError('Введите корректный номер телефона');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await addStaff(
                companyId,
                roleInput.trim(),
                phoneInput,
                nameInput.trim(),
            );
            console.log('Ответ addStaff:', data);

            if (!data.ok) {
                setError(data.error || 'Не удалось добавить сотрудника');
                return;
            }

            setStaff((prev) => [
                ...prev,
                {
                    id: data.staff_id ?? Date.now(),
                    full_name: nameInput.trim(),
                    role: roleInput.trim(),
                    phone: phoneInput,
                },
            ]);

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
                    {staff.length === 0 && (
                        <CellSimple title="Пока никого нет">
                            Добавьте первого сотрудника
                        </CellSimple>
                    )}

                    {staff.map((member) => (
                        <CellSimple
                            key={member.id}
                            before={
                                <Avatar.Container size={40}>
                                    <Avatar.Text>
                                        {member.full_name?.[0]?.toUpperCase() || '?'}
                                    </Avatar.Text>
                                </Avatar.Container>
                            }
                            onClick={() => {}}
                            showChevron
                            title={member.full_name}
                        >
                            {member.role} · {member.phone}
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
                            <Typography.Text>ФИО</Typography.Text>
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                placeholder="Иван Иванов"
                                style={inputStyle}
                            />
                        </Flex>

                        <Flex direction="column" gap={4}>
                            <Typography.Text>Должность</Typography.Text>
                            <input
                                type="text"
                                value={roleInput}
                                onChange={(e) => setRoleInput(e.target.value)}
                                placeholder="Например: Диспетчер"
                                style={inputStyle}
                            />
                        </Flex>

                        <Flex direction="column" gap={4}>
                            <Typography.Text>Телефон</Typography.Text>
                            <input
                                type="tel"
                                inputMode="numeric"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
                                placeholder="+7 (999) 000-00-00"
                                style={inputStyle}
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