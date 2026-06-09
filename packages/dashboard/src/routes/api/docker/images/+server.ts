import { defineRoute } from '$lib/server/route-helper';
import { listImages } from '$lib/server/docker/real-data';

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'docker',
	action: 'docker.images.list',
	handler: async () => {
		const images = await listImages();
		return { images };
	},
});
