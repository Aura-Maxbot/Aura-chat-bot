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

const AdminScreen = ({ companyName, fullName }) => {
    const companyInitial = companyName ? companyName.trim()[0].toUpperCase() : '?';

    // Пока пустой список — потом заменим на данные из API
    const staff = [];

    return (
        <Panel mode="secondary" style={{ minHeight: '100vh' }}>
            <Grid gap={16} cols={1} style={{ padding: 16 }}>

                {/* 1. Шапка профиля */}
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

                {/* 2. Список сотрудников */}
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

                {/* 3. Кнопка добавления сотрудника */}
                <Button
                    appearance="themed"
                    mode="primary"
                    size="medium"
                    onClick={() => {}}
                >
                    Добавить сотрудника
                </Button>

            </Grid>
        </Panel>
    );
};

export default AdminScreen;