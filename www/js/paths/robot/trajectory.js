import {Pose2d} from "../geo/pose2d.js";
import {epsilonEquals} from "../geo/test.js";
import {Spline2Array} from "../geo/spline2array.js";

export class Trajectory
{
    constructor(poseSamples)
    {
        this.poseSamples = poseSamples;
        this.timedPoses = [];
    }

    reverse()
    {
    }

    mirror()
    {
    }

    draw(ctx, mode, color)
    {
        for(let p of this.poseSamples)
            p.draw(ctx, color);
    }

    // returns a trajectory:
    //   array of pose2d,curvature,dcurvature,time
    //  cf: timeParameterizeTrajectory (java implementation)
    static generate(samples, timingConstraints, stepSize,
            startVelocity, endVelocity, maxVelocity, maxAbsAccel)
    {
        // Resample with equidistant steps along the trajectory. 
        // Note that we may have sampled the spline with the same 
        // value for stepSize. In that case, we were working on the xy 
        // plane. Now, we're working along the robot trajectory. 
        //
        let result = [];
        let totalDist = 0;
        samples[0].distance = 0.0;
        result.push(samples[0]);
        let last = samples[0];
        let next;
        for(let i=1;i<samples.length;i++)
        {
            next = samples[i];
            let dist = next.distance(last);
            totalDist += dist;
            if(dist >= stepSize)
            {
                let pct = stepSize/dist;
                let ipose = last.interpolate(next, pct);
                result.push(ipose);
                last = ipose;
            } 
            else
            if(i == samples.length-1)
            {
                // last sample isn't as far as stepSize, but it
                // is important, so lets just append it for now.
                result.push(next);
            }
        }

        if(timingConstraints)
        {
            // apply time constraints to deliver per-sample  velocity 
            // target. (tbd)
            Trajectory.applyTimingConstraints(result, timingConstraints,
                    startVelocity, endVelocity, maxVelocity, maxAbsAccel);
        }

        return new Trajectory(result);
    }

    static applyTimingConstraints(samples, constraints,
                                vel0, vel1, maxV, maxAbsAccel)
    {
        // Forward pass. We look at pairs of consecutive states, where the start 
        // state has already been assigned a velocity (though we may adjust 
        // the velocity downwards during the backwards pass). We wish to find an
        // acceleration that is admissible at both the start and end state, as 
        // well as an admissible end velocity. If there is no admissible end 
        // velocity or acceleration, we set the end velocity to the state's 
        // maximum allowed velocity and will repair the acceleration during the 
        // backward pass (by slowing down the predecessor).
        const kEpsilon = 1e-6;
        let last = samples[0];
        last.distance = 0;
        last.maxVel = vel0;
        last.accelLimits = [-maxAbsAccel, maxAbsAccel];
        for(let i=1;i<samples.length;i++)
        {
            let s = samples[i];
            const ds = s.distance(last);
            s.distance = ds + last.distance;

            // Enforce global maxvel and max reachable vel by global
            // accel limits. (we may need to interate to find the max vel1
            // and common accel limits may be a functionof vel)
            while(true)
            {
                // Enforce global max velocity and max reachable velocity by 
                // global acceleration limit. vf = sqrt(vi^2 + 2*a*d)
                s.maxVel = Math.min(maxV, 
                            Math.sqrt(last.maxVel*last.maxVel + 
                                      2*last.accelLimits.max * ds));
                s.accelLimits = [-maxAbsAccel, maxAbsAccel];

                // At this point s is ready, but no constraints have been 
                // applied aside from last state max accel.

                // lets first apply velocity constraints
                for(let c of constraints)
                {
                    s.maxVel = Math.min(s.maxVel, c.getMaxVel(s));
                    if(s.maxVel < 0)
                    {
                        // shouldn't happen
                        throw "trajectory maxvel underflow";
                    }
                }

                // now enforce accel constraints
                for(const c of constraints)
                {
                    let minmax = c.getMinMaxAcceleration(s, s.maxVel);
                    if(minmax[1] < minmax[0])
                        throw "trajectory bogus minmax accel 0";
                    // reverse could be applied here... (subtle)
                    s.accelLimits[0] = Math.max(s.accelLimits[0],
                                                minmax[0]);
                    s.accelLimits[1] = Math.min(s.accelLimits[1],
                                                minmax[1]);
                }
                if(s.accelLimits[0] > s.accelLimits[1])
                    throw "trajectory bogus minmax accel 1";
                
                if(ds < kEpsilon) break;

                // If the max acceleration for this state is more conservative 
                // than what we had applied, we need to reduce the max accel at 
                // the predecessor state and try again.
                // TODO: Simply using the new max acceleration is guaranteed to 
                //  be valid, but may be too conservative. Doing a search would 
                //  be better
                let actualAccel = (s.maxVel*s.maxVel - last.maxVel*last.maxVel) 
                                    / (2.0 * ds); 
                if(s.accelLimits[1] < (actualAccel-kEpsilon))
                    last.accelLimits[1] = s.accelLimits[1];
                else
                {
                    if(actualAccel > (last.accelLimits[0]+kEpsilon))
                    {
                        last.accelLimits[1] = actualAccel;
                    }
                    // if actual accel is less than last minaccel,
                    // we repapir it in backward pass.
                    break; // while 1 loop
                }
            }
            last = s;
        }

        // Backward Pass
        let next = samples[samples.length-1];
        if(next.distance == undefined)
            throw "trajectory: bogus backward state";
        next.maxVel = vel1;
        next.accelLimts = [-maxAbsAccel, maxAbsAccel];
        for(let i=samples.length-2; i>=0; --i)
        {
            let s = samples[i]; // 
            const ds = s.distance - next.distance;
            while(true)
            {
                const newMaxVel = Math.sqrt(next.maxVel*next.maxVel +
                                            2*next.accelLimits[0] * ds);
                if(newMaxVel >= s.maxVel)
                    break; //  no new limits to impose
                s.maxVel = newMaxVel;
                for(const c of constraints)
                {
                    let minmax = c.getMinMaxAcceleration(s, s.maxVel);
                    if(minmax[1] < minmax[0])
                        throw "trajectory bogus minmax accel 2";
                    // xxx: reverse not implemented
                    s.accelLimits[0] = Math.max(s.accelLimits[0],
                                                minmax[0]);
                    s.accelLimits[1] = Math.min(s.accelLimits[1],
                                                minmax[1]);
                }
            }
            if(s.accelLimits[0] > s.accelLimits[1])
                throw "trajectory bogus minmax accel 1";
            if(ds < kEpsilon) 
                break;
            const actualAccel = (s.maxVel*s.maxVel - next.maxVel*last.maxVel) 
                                    / (2.0 * ds); 
            if(s.accelLimits[0] > (actualAccel + kEpsilon))
                next.accelLimits[0] = s.accelLimits[0];
            else
            {
                next.accelLimits[0] = actualAccel;
                break;
            }
        }
        next = s;
    }
}

export default Trajectory;
