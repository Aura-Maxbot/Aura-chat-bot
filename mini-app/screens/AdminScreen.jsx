import { Panel, Flex, Typography } from '@maxhub/max-ui';

const AdminScreen = ({ companyName }) => (
    <Panel mode="secondary" style={{ minHeight: '100vh' }}>
        <Flex direction="column" align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
            <Typography.Title style={{ textAlign: 'center' }}>
                Личный кабинет админа
            </Typography.Title>
            {companyName && (
                <Typography.Text style={{ marginTop: 12 }}>
                    {companyName}
                </Typography.Text>
            )}
        </Flex>
    </Panel>
);

export default AdminScreen;