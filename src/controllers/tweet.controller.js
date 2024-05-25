import { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Tweet } from "../models/tweet.model.js";
import mongoose from "mongoose";


//create tweet
const createTweet = asyncHandler(async (req, res) => {
      const { content } = req.body

      if (!content) {
            throw new ApiError(400, "contanet is requird")
      }

      const tweet = await Tweet.create({
            content,
            owner: req.user?._id
      })

      if (!tweet) {
            throw new ApiError(500, "Some error occurred while creating tweet")
      }

      return res
            .status(200)
            .json(new ApiResponse(200, tweet, "tweet created successfully"))
})
//get user tweets
const getUserTweets = asyncHandler(async (req, res) => {
      const { userId } = req.params

      if (!isValidObjectId(userId)) {
            throw new ApiError(400, "invalid userId")
      }

      const tweets = await Tweet.aggregate([
            {
                  $match: {
                        owner: new mongoose.Types.ObjectId(userId)
                  }
            },
            {
                  $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "ownerDetails",
                        pipeline: [
                              {
                                    $project: {
                                          avatar: 1,
                                          username: 1,
                                    }
                              }
                        ]
                  }
            },
            {
                  $lookup: {
                        from: "likes",
                        localField: "_id",
                        foreignField: "tweet",
                        as: "likeDetails",
                        pipeline: [
                              {
                                    $project: {
                                          likedBy: 1
                                    }
                              }
                        ]
                  }
            },
            {
                  $addFields: {
                        likesCount: {
                              $size: "$likeDetails"
                        },
                        ownerDetails: {
                              $first: "$ownerDetails"
                        },
                        isLiked: {
                              $cond: {
                                    if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
                                    then: true,
                                    else: false
                              }
                        }
                  }
            },
            {
                  $sort: {
                        createAt: -1
                  }
            },
            {
                  $project: {
                        content: 1,
                        ownerDetails: 1,
                        likesCount: 1,
                        isLiked: 1
                  }
            }
      ]);
      return res
            .status(200)
            .json(new ApiResponse(200, tweets, "tweets fetched successfully"))
})

//update tweet
const updateTweet = asyncHandler(async (req, res) => {
      const { content } = req.body
      const { tweetId } = req.params

      if (!content) {
            throw new ApiError(400, "contanet is requird")
      }

      if (!isValidObjectId(tweetId)) {
            throw new ApiError(400, "invald tweetId")
      }

      const tweet = await Tweet.findById(tweetId)

      if (!tweet) {
            throw new ApiError(400, "not found tweet")
      }

      if (tweet?.owner.toString() !== req.user?._id.toString()) {
            throw new ApiError(404, "you are not owner, so you can't update it")
      }

      const newTweet = await Tweet.findByIdAndUpdate(
            tweetId, {
            $set: {
                  content
            }
      }, {
            new: true
      }
      );

      if (!newTweet) {
            throw new ApiError(500, "Some error occurred while updateing tweet")
      }
      return res
            .status(200)
            .json(new ApiResponse(200, newTweet, "tweet has been successfully update "))
})

//delete tweet
const deleteTweet = asyncHandler(async (req, res) => {
      const { tweetId } = req.params

      if (!isValidObjectId(tweetId)) {
            throw new ApiError(400, "invald tweetId")
      }

      const tweet = await Tweet.findById(tweetId)

      if (!tweet) {
            throw new ApiError(400, "not found tweet")
      }

      if (tweet?.owner.toString() !== req.user?._id.toString()) {
            throw new ApiError(404, "you are not owner, so you can't update it")
      }

      const deletedTweet = await Tweet.findByIdAndDelete(tweetId)

      if (!deletedTweet) {
            throw new ApiError(500, "Some error occurred while deleting tweet")
      }
      return res
            .status(200)
            .json(new ApiResponse(200, { tweetId }, "deleted tweet successfully"))
})

export {
      createTweet,
      getUserTweets,
      updateTweet,
      deleteTweet
}