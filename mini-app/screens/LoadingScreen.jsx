import { Panel, Flex, Typography } from '@maxhub/max-ui';

const LoadingScreen = () => (
    <Panel mode="secondary" style={{ minHeight: '100vh' }}>
        <Flex direction="column" align="center" justify="center" style={{ minHeight: '100vh' }}>
            <Typography.Title>Загрузка</Typography.Title>
        </Flex>
    </Panel>
);

export default LoadingScreen;