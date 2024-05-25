import { asyncHandler } from '../utils/asyncHandler.js'
import mongoose, { isValidObjectId, ObjectId } from 'mongoose'
import { Video } from '../models/video.model.js'
import { User } from '../models/user.model.js'
import {Comment}  from "../models/comment.model.js"
import { Like } from "../models/like.model.js";
import { ApiError } from '../utils/ApiError.js'
import { uploadOnCloudinary , deleteOnCloudinary} from '../utils/cloudnary.js'
import { ApiResponse } from '../utils/ApiResponse.js'


//get all videos based on query, sort, pagination
const getAllVideo = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    const pipeline = []

    if(query){
        pipeline.push({
            $search: {
                index: "search-videos",
                text:{
                    query:query,
                    path:["title", "description"]
                }
            }
        });
    }

    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(400, "invalid userId")
        }

        pipeline.push({
            $match:{
                owner: ObjectId(userId)
            }
        });
    }

    pipeline.push({
        $match:{
            isPublished:true
        }
    });

    if(sortBy && sortType){
        pipeline.push({
            $sort:{
                [sortBy]: sortType === 'asy' ? 1: -1
            }
        });
    }else{
        pipeline.push({
            $sort:{
                createdAt: -1
            }
        });
    }

    pipeline.push({
        $lookup:{
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "ownerDetails",
            pipeline:[
                {
                    $project:{
                        username:1,
                        "avatar.url":1
                    }
                }
            ]
        }
    },
    {
        $unwind:"$ownerDetails"
    }
)

    const videoAggregate = Video.aggregate(pipeline)
     
    const options = {
        page: parseInt(page, 1),
        limit: parseInt(limit,10)
    }

    const video = await Video.aggregatePaginate(videoAggregate, options)

    return res
    .status(200)
    .json(new ApiResponse(200, video," video fetched successfully"))
})

//get video, upload cloudinary, create video
const publishVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All field are required")
    }

    const videoFileLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "videoFile is required")
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail is required")
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!videoFile) {
        throw new ApiError(400, "videoFile is required")
    }

    if (!thumbnail) {
        throw new ApiError(400, "videoFile is required")
    }

    const video = await User.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
        isPublished: false
    });

    const videoUploaded = Video.findById(video._id)

    if (!videoUploaded) {
        throw new ApiError(500, "!!! something went worng while uploding video")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "video uploaded successfully"))

})

//get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "invalid videoId")
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: " likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
                            },
                            isPublished: {
                                $cond: {
                                    if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                                    than: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscribersCount: 1,
                            isPublished: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likeBy"] },
                        than: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                duration: 1,
                Comment: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);
    if (!video) {
        throw new ApiError(500, "failed to fetched video ")
    }
    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });
    return res
        .status(200)
        .json(new ApiResponse(200, video[0], "video details fetched successfully"))
})

// update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
    const {title,description} = req.body
    const { videoId } = req.params

    if(!(title && description)){
        throw new ApiError(400, "all fields are required")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoid")
    }
   
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "video not found")
    }

    if(video?.owner.tostring() !== req.user?._id.tostring()){
        throw new ApiError(400, "you are not owner so you can not change anytiong")
    }

    const thumbnailToDelete = await video.thumbnail.public_id
    const thumbnailLocalPath = req.files?.path;

    if(!thumbnailLocalPath){
        throw new ApiError(400, "thumbnail is required")
    }
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!thumbnail){
        throw new ApiError(400, "something want worng while uploding")
    }

    const updateVideo = await Video.findByIdAndUpdate(
        videoId,{
            $set:{
                title,
                description,
                thumbnail:{
                    public_id:thumbnail.public_id,
                    url:thumbnail.url
                }
            }
        },
        {
            new: true
        }
    );

    if(!updateVideo){
        throw new ApiError(500, " uploding failed  !. please try again")
    }

    if(updateVideo){
         await deleteOnCloudinary(thumbnailToDelete)
    }
    return res
    .status(200)
    .json(new ApiResponse(200, updateVideo, "video updated successfully"));
});

//delet video
const deletVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoid")
    }
   
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "video not found")
    }

    if(video?.owner.tostring() !== req.user?._id.tostring()){
        throw new ApiError(400, "you are not owner so you can not change anytiong")
    }

    const videoDeleted =  await Video.findByIdAndDelete(video?._id)

    if(!videoDeleted){
        throw new ApiError(400, "some problem occurred while deleted video")
    }

    await deleteOnCloudinary(video.thumbnail.public_id);
    await deleteOnCloudinary(video.videoFile.public_id,"video")

    await Like.deleteMany({
        video: videoId
    })

    await Comment.deleteMany({
        video:videoId
    })

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "video deleted successfully"))
})


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid videoid")
    }
   
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "video not found")
    }

    if(video?.owner.tostring() !== req.user?._id.tostring()){
        throw new ApiError(400, "you are not owner so you can not change anytiong")
    }

    const toggleVideoPublish = await Video.findByIdAndUpdate(videoId,{
        $set:{
            isPublished: !video?.isPublished
        },
    },
    {
        new:true
    }
    );
    if(!toggleVideoPublish){
        throw new ApiError(404, "Failed to toogle video publish status")
    }
    
    return res
    .status(200)
    .json(new ApiResponse(200, {isPublished: toggleVideoPublish.isPublished},"video publish toggle successfully")
    );
});


export {
    getAllVideo,
    publishVideo,
    getVideoById,
    updateVideo,
    deletVideo,
    togglePublishStatus

}