import {
    VideoApi,
    type VideoApiDeleteAlternateSourcesRequest
} from 'lib/tesserafin-sdk/generated/api/video-api';
import { useMutation } from '@tanstack/react-query';
import { type TesserafinApiContext, useApi } from 'hooks/useApi';

const deleteAlternateSources = async (
    apiContext: TesserafinApiContext,
    params: VideoApiDeleteAlternateSourcesRequest
) => {
    const { reefinApi: api } = apiContext;

    if (!api)
        throw new Error('[deleteAlternateSources] No API instance available');

    const response = await new VideoApi(
        api.configuration,
        undefined,
        api.axiosInstance
    ).deleteAlternateSources(params);
    return response.data;
};

export const useDeleteAlternateSources = () => {
    const apiContext = useApi();
    return useMutation({
        mutationFn: (params: VideoApiDeleteAlternateSourcesRequest) =>
            deleteAlternateSources(apiContext, params)
    });
};
