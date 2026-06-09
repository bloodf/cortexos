import { defineRoute } from '$lib/server/route-helper';
import { listVolumes } from '$lib/server/docker/real-data';

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'docker',
	action: 'docker.volumes.list',
	handler: async () => {
		const volumes = await listVolumes();
		return { volumes };
	},
});
