import { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { Subscription } from "../models/subscription.model.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(404, "invald userId")
    }

    const isSubscribed = await Subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId
    })

    if (isSubscribed) {
        await Subscription.findByIdAndDelete(isSubscribed?._id)

        return res
            .status(200)
            .json(new ApiResponse(200, { subscribed: false }, "unsubscribed successfully"))
    } else {
        await Subscription.create({
            subscriber: req.user?._id,
            channel: channelId
        });

        return res
            .status(200)
            .json(new ApiResponse(200, { subscribed: true }, "subscribed successfully"))
    }
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(404, "invald userId")
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribedToSubscriber",
                        }
                    },
                    {
                        $addFields: {
                            subscribedToSubscriber: {
                                $cond: {
                                    if: { $in: [channelId, "$subscribedToSubscriber.subscriber"] },
                                    than: true,
                                    else: false
                                },
                            },
                            subscriberCount: {
                                $size: "$subscribedToSubscriber"
                            }
                        }
                    }
                ]
            }
        }, {
            $unwind: "$subscriber"
        },
        {
            $project: {
                subscriber: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                    subscribedToSubscriber: 1,
                    subscriberCount: 1
                }
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, subscribers, "subscribers fetched successfully"))

})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(404, "invald subscriberId")
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.OBjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannel",
                pipeline: [
                    {
                        $lookup: {
                            from: "videos",
                            localField: "_id",
                            foreignField: "owner",
                            as: "videos",
                        }
                    },
                    {
                        $addFields: {
                            latestVideo: {
                                $last: "$videos"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$subscribedChannel"
        },
        {
            $project: {
                subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                    latestVideo: {
                        _id: 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        ownwr: 1,
                        tital: 1,
                        description: 1,
                        duration: 1,
                        views: 1
                    }
                }
            }
        }
    ]);
    return res
        .status(200)
        .json(new ApiResponse(200, subscribedChannels, "subscribed channels fetched successfully"))
})
export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}


