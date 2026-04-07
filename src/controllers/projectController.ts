import { Response, NextFunction } from "express";
import { ProjectService } from "../services/projectService";
import { AuditService } from "../services/auditService";
import { AuthRequest } from "../types";

export class ProjectController {
  static async create(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const project = await ProjectService.create(
        req.body,
        req.user!._id.toString()
      );
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Project created",
        module: "projects",
        details: `${project.name} (${project.client})`,
        ipAddress: req.ip,
      });
      res.status(201).json({
        success: true,
        message: "Project created successfully.",
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await ProjectService.getAll(req.query as any);
      res.status(200).json({
        success: true,
        message: "Projects fetched successfully.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const project = await ProjectService.getById(req.params.id as string);
      res.status(200).json({
        success: true,
        message: "Project fetched successfully.",
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const project = await ProjectService.update(req.params.id as string, req.body);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Project updated",
        module: "projects",
        details: project.name,
        ipAddress: req.ip,
      });
      res.status(200).json({
        success: true,
        message: "Project updated successfully.",
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await ProjectService.delete(req.params.id as string);
      AuditService.log({
        userId: req.user!._id.toString(),
        action: "Project deleted",
        module: "projects",
        details: `Project ID: ${req.params.id}`,
        ipAddress: req.ip,
      });
      res.status(200).json({
        success: true,
        message: "Project deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
}
