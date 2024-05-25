import { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { PlayList } from "../models/playlist.model.js"
import { Video } from "../models/video.model.js";


//create playlist
const createPlaylist = asyncHandler(async (req, res) => {
   const { name, description } = req.body

   if ([name, description].some((field) => field?.trim() === "")) {
      throw new ApiError(400, "all fields are required")
   }

   const playList = await PlayList.create({
      name,
      description,
      owner: req.user?._id
   })

   if (!playList) {
      throw new ApiError(500, "some error occurred while creating playlist")
   }

   return res
      .status(200)
      .json(new ApiResponse(200, playList, " playlist created successfully"))

})

//get user playlist
const getUserPlaylists = asyncHandler(async (req, res) => {
   const { userId } = req.params

   if (!isValidObjectId(userId)) {
      throw new ApiError(404, "invald userId")
   }

   const playList = await PlayList.aggregate([
      {
         $match: {
            owner: new mongoose.Types.ObjectId(userId)
         }
      },
      {
         $lookup: {
            from: "videos",
            localField: "videos",
            foreignField: "_id",
            as: "videos"
         },
      },
      {
         $addFields: {
            totalVideos: {
               $size: "$videos"
            },
            totalViews: {
               $sum: "$videos.views"
            }
         }
      },
      {
         $project: {
            _id: 1,
            name: 1,
            description: 1,
            totalVideos: 1,
            totalViews: 1
         }
      }
   ]);

   if (!playList) {
      throw new ApiError(400, "Not found playListId")
   }

   if (!playList?.length()) {
      throw new ApiError(404, "user does't exist")
   }

   return res
      .status(200)
      .json(new ApiResponse(200, playList, " user playlist fetched successfully"))

})

//get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
   const { playlistId } = req.params

   if (!isValidObjectId(playlistId)) {
      throw new ApiError(400, "invald playListId")
   }

   const playListVideo = await PlayList.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(playlistId)
         }
      },
      {
         $lookup: {
            from: "videos",
            localField: "videos",
            foreignField: "_id",
            as: "videos"
         }
      },
      {
         $match: {
            "videos.isPublished": true
         }
      },
      {
         $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner"
         }
      },
      {
         $addFields: {
            totalVideos: {
               $size: "$videos"
            },
            totalViews: {
               $sum: "$videos.views"
            },
            owner: {
               $first: "$owner"
            }
         }
      },
      {
         $project: {
            name: 1,
            description: 1,
            totalVideos: 1,
            totalViews: 1,
            videos: {
               _id: 1,
               "videoFile.url": 1,
               "thumbnail.url": 1,
               tital: 1,
               description: 1,
               duration: 1,
               views: 1
            },
            owner: {
               username: 1,
               fullName: 1,
               avatar: 1
            }
         }
      }
   ]);

   return res
      .status(200)
      .json(new ApiResponse(200, playListVideo, "playList fetched successfully"))

})

// add videos in playlist
const addVideoToPlaylist = asyncHandler(async (req, res) => {
   const { playlistId, videoId } = req.params

   if (!isValidObjectId(videoId) && !isValidObjectId(playlistId)) {
      new ApiError(404, "invald videoId or playlistId")
   }

   const playList = await PlayList.findById(playlistId)
   const video = await Video.findById(videoId)

   if (!playList) {
      throw new ApiError(400, "Not found playListId")
   }

   if (!video) {
      throw new ApiError(400, "Not found videoId")
   }

   if (playList.owner?.toString && video.owner?.toString !== req.user?._id.toString()) {
      throw new ApiError(401, "you can't add video in playlist? becouse you are not owner ")
   }

   const addVideo = await PlayList.findByIdAndUpdate(
      playList?._id, {
      $addToSet: {
         videos: videoId
      }
   },
      {
         new: true
      }
   );

   if (!addVideo) {
      throw new ApiError(500, "Some error occurred while adding video to playlist")
   }
   return res
      .status(200)
      .json(new ApiResponse(200, addVideo, "video successfull added to playlist"))
})

//remov video from playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
   const { playlistId, videoId } = req.params

   if (!isValidObjectId(videoId) && !isValidObjectId(playlistId)) {
      new ApiError(404, "invald videoId or playlistId")
   }

   const playList = await PlayList.findById(playlistId)
   const video = await Video.findById(videoId)

   if (!playList) {
      throw new ApiError(400, "Not found playListId")
   }

   if (!video) {
      throw new ApiError(400, "Not found videoId")
   }

   if (playList.owner?.toString && video.owner?.toString !== req.user?._id.toString()) {
      throw new ApiError(401, "you can't add video in playlist? becouse you are not owner ")
   }

   const removeVideo = await PlayList.findByIdAndUpdate(
      playList?._id, {
      $pull: {
         videos: video
      }
   },
      {
         new: true
      }
   );
   if (!removeVideo) {
      throw new ApiError(500, "Some error orccurred while Removeing video from playlist")
   }
   return res
      .status(200)
      .json(new ApiResponse(200, removeVideo, "video  successfull removed from playlist"))
})

//delete playlist
const deletePlaylist = asyncHandler(async (req, res) => {
   const { playlistId } = req.params

   if (isValidObjectId(playlistId)) {
      throw new ApiError(404, "invald playlistId")
   }

   const playList = await PlayList.findById(playlistId)

   if (!playList) {
      throw new ApiError(400, "playList not found ")
   }

   if (playList?.owner.toString() !== req.user?._id.toString()) {
      throw new ApiError(200, "you are not owner. so you can't delete it")
   }

   const deletePlayList = await PlayList.findByIdAndDelete(playlistId)

   if (!deletePlayList) {
      throw new ApiError(500, "some error occurred while deleting playlist")
   }

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "playlist deleted successfully"))
})

//update playlist
const updatePlaylist = asyncHandler(async (req, res) => {
   const { playListId } = req.params
   const { name, description } = req.body

   if ([name, description].some((field) => field?.trim() === "")) {
      throw new ApiError(400, "all fields are required")
   }

   if (isValidObjectId(playListId)) {
      throw new ApiError(404, "invald playlistId")
   }

   const playList = await PlayList.findById(playListId)

   if (!playList) {
      throw new ApiError(400, "playlist not found")
   }

   if (playList?.owner.toString() !== req.user?._id.toString) {
      throw new ApiError(404, "you are not owner. so you can not channge anything")
   }

   const updatePlayList = await PlayList.findByIdAndUpdate(
      playList?._id,
      {
         $set: {
            name,
            description
         }

      },
      {
         new: true,
      }

   );

   if (!updatePlayList) {
      throw new ApiError(500, "some error occurred while updating playlist")
   }
   return res
      .status(200)
      .json(new ApiResponse(200, updatePlayList, "playList has been successfully update"))
})

export {
   createPlaylist,
   getUserPlaylists,
   getPlaylistById,
   addVideoToPlaylist,
   removeVideoFromPlaylist,
   deletePlaylist,
   updatePlaylist
}