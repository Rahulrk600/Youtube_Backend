import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { Like } from "../models/like.model.js"
import { ApiResponse } from '../utils/ApiResponse.js'



//toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
   const { videoId } = req.params

   if (isValidObjectId(videoId)) {
      throw new ApiError(404, "invalid videoId")
   }

   const isAlreadyLike = await Like.findOne({
      video: videoId,
      likedBy: req.user?._id,
   })

   if (isAlreadyLike) {
      Like.findByIdAndDelete(isAlreadyLike?._id);
      return res
         .status(200)
         .json(new ApiResponse(200, { isLiked: false }))
   }
   else {
      Like.create({
         video: videoId,
         likedBy: req.user?._id
      });
      return res
         .status(200)
         .json(new ApiResponse(200, { isLiked: true }))
   }

})

//toggle like on Comment
const toggleCommentLike = asyncHandler(async (req, res) => {
   const { commentId } = req.params

   if (isValidObjectId(commentId)) {
      throw new ApiError(404, "invalid videoId")
   }

   const isAlreadyLike = await Like.findOne({
      comment: commentId,
      likedBy: req.user?._id,
   })

   if (isAlreadyLike) {
      Like.findByIdAndDelete(isAlreadyLike?._id);
      return res
         .status(200)
         .json(new ApiResponse(200, { isLiked: false }))
   }
   else {
      Like.create({
         comment: commentId,
         likedBy: req.user?._id
      });
      return res
         .status(200)
         .json(new ApiResponse(200, { isLiked: true }))
   }
})

//toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
   const { tweetId } = req.params

   if (isValidObjectId(tweetId)) {
      throw new ApiError(404, "invalid videoId")
   }

   const isAlreadyLike = await Like.findOne({
      tweet: tweetId,
      likedBy: req.user?._id,
   })

   if (isAlreadyLike) {
      Like.findByIdAndDelete(isAlreadyLike?._id);
      return res
         .status(200)
         .json(new ApiResponse(200, { isLiked: false }))
   }
   else {
      Like.create({
         tweet: tweetId,
         likedBy: req.user?._id
      });
      return res
         .status(200)
         .json(new ApiResponse(200, { isLiked: true }))
   }
})

//get all liked  videos
const getLikedVideos = asyncHandler(async (req, res) => {
   const likeVideoAggegate = await Like.aggregate([

      {
         $match: {
            likedBy: new mongoose.Types.ObjectId(req.user?._id)
         }
      },
      {
         $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "likedVideo",
            pipeline: [
               {
                  $lookup: {
                     from: "users",
                     localField: "owner",
                     foreignField: "_id",
                     as: "ownerDetails",
                  }
               },
               {
                  $unwind: "$ownerDetails",
               },
            ],
         },
      },
      {
         $unwind: "$likedVideo"
      },
      {
         $sort: {
            createAt: -1,
         },
      },
      {
         $project: {
            likedVideo: {
               _id: 1,
               "video.url": 1,
               thumbnail: 1,
               owner: 1,
               tital: 1,
               description: 1,
               views: 1,
               duration: 1,
               isPublished: 1,
               ownerDetails: {
                  username: 1,
                  fullName: 1,
                  avatar: 1,
               }
            }
         }
      }
   ]);
   return res
      .status(200)
      .json(new ApiResponse(200, likeVideoAggegate, "liked video fetched successfully"))
})

export {
   toggleVideoLike,
   toggleCommentLike,
   toggleTweetLike,
   getLikedVideos
}

