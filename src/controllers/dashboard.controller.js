
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import { Subscription } from "../models/subscription.model.js";
import { Video } from "../models/video.model.js";



// get all channel stats like total video views, total subscribers,total video, total like ,etc
const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(404, "not find userid");
    }

    const totalSubscribars = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: null,
                SubscribarsCount: {
                    $sum: 1
                }
            }
        }
    ]);

    const video = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.objectId(userId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likeas"
            }
        },
        {
            $project: {
                totalLikes: {
                    $size: "$likes"
                },
                totalViews: "$views",
                totalVideo: 1
            }
        },
        {
            $group: {
                _id: null,
                totalLikes: {
                    $sum: "$totalLikes"
                },
                totalViews: {
                    $sum: "$totalViews"
                },
                totalVideo: {
                    $sum: 1
                }
            }
        }
    ]);

    const channelStats = {
        totalSubscribars: totalSubscribars[0]?.SubscribarsCount || 0,
        totalLikes: video[0]?.totalLikes || 0,
        totalViews: video[0]?.totalViews || 0,
        totalVideo: video[0]?.totalVideo || 0
    };

    return res
        .status(200)
        .json(new ApiResponse(200, channelStats, "channel status fetched successfully"))

});

//get all the videos uploaded by the channel
const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id

    const videos = await Video.aggregate([
        {
            $match: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                _id: 1,
                "videoFile.url": 1,
                "thumbnail.url": 1,
                tital: 1,
                description: 1,
                isPublished: 1,
                likesCount: 1
            },
        }
    ]);
    return res
        .status(200)
        .json(new ApiResponse(200, videos, "channel status fetched successfully"))
})

export {
    getChannelStats,
    getChannelVideos
}