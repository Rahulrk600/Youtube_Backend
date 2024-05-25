
import { Comment } from "../models/comment.model.js"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"


//get all comments for a video
const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "video not found")
    }

    const commentAggregate = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
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
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $frist: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
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
                createAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullname: 1,
                    avatar: 1
                },
                isLiked: 1
            }
        }
    ]);
    const options = {
        page: parseInt(page, 1),
        limit: parseInt(limit, 10)
    }

    const comment = await Comment.aggregatePaginate(commentAggregate, options)

    return res
        .status(200)
        .json(new ApiResponse(200, comment, " comment add sucessfully"))
})

//add a comment to a vodeo
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    if (!content) {
        throw new ApiError(400, "Contant is requird")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "video not found")
    }

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    });

    if (!comment) {
        throw new ApiError(500, "some problem occurred while adding comment")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, comment, "add comment successfully"))




})

//update a comment
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body

    if (!content) {
        throw new ApiError(400, "content is required")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(400, "comment not found")
    }

    if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "you cant't change . becouse you are not owner")
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        comment?._id, {
        $set: {
            content
        }
    },
        { new: true }
    )

    if (!updatedComment) {
        throw new ApiError(500, "some problem occurred while updateing comment")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedComment, "successfully update your comment "))
})

//delete a comment
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404, "comment  not found")
    }

    if (comment?.owner._id.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "you cont't delete comment becouse you not owner ")
    }

    await Comment.findByIdAndDelete(commentId)

    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user
    })

    return res
        .status(200)
        .json(new ApiResponse(200, { commentId }, "comment has been deleted"))


})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}