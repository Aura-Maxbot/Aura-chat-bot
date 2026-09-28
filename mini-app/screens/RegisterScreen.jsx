import { Panel, Flex, Typography } from '@maxhub/max-ui';

const RegisterScreen = () => (
    <Panel mode="secondary" style={{ minHeight: '100vh' }}>
        <Flex direction="column" align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
            <Typography.Title style={{ textAlign: 'center' }}>
                Зарегистрируйтесь, чтобы войти в личный кабинет
            </Typography.Title>
        </Flex>
    </Panel>
);

export default RegisterScreen;